import os
import uuid
import requests as http
from flask import Blueprint, jsonify, request
from app import db
from app.models import Invoice, BusinessProfile

public_bp = Blueprint("public", __name__)

PAYSTACK_BASE_URL = "https://api.paystack.co"


def _paystack_headers():
    return {
        "Authorization": f"Bearer {os.environ.get('PAYSTACK_SECRET_KEY', '')}",
        "Content-Type": "application/json",
    }


@public_bp.route("/invoices/<token>", methods=["GET"])
def get_public_invoice(token):
    invoice = Invoice.query.filter_by(public_token=token).first_or_404()
    profile = BusinessProfile.get_or_create().to_dict()
    return jsonify({
        "invoice": invoice.to_dict(),
        "business": profile,
    })


@public_bp.route("/invoices/<token>/checkout", methods=["POST"])
def public_checkout(token):
    invoice = Invoice.query.filter_by(public_token=token).first_or_404()

    if invoice.status == Invoice.STATUS_PAID:
        return jsonify({"error": "This invoice is already paid"}), 400

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    currency = os.environ.get("PAYSTACK_CURRENCY", "KES")
    reference = f"INV-{invoice.id}-{uuid.uuid4().hex[:10]}"
    amount_minor = int(float(invoice.total) * 100)

    payload = {
        "email": invoice.client.email,
        "amount": amount_minor,
        "currency": currency,
        "reference": reference,
        "callback_url": f"{frontend_url}/pay/{token}?reference={reference}",
        "metadata": {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "client_name": invoice.client.name,
        },
    }

    response = http.post(
        f"{PAYSTACK_BASE_URL}/transaction/initialize",
        json=payload,
        headers=_paystack_headers(),
        timeout=10,
    )

    if not response.ok:
        error_msg = response.json().get("message", "Could not initialize payment")
        return jsonify({"error": error_msg}), 502

    data = response.json()["data"]
    invoice.payment_reference = reference
    if invoice.status == Invoice.STATUS_DRAFT:
        invoice.status = Invoice.STATUS_SENT
    db.session.commit()

    return jsonify({"url": data["authorization_url"], "reference": reference})


@public_bp.route("/invoices/<token>/verify-payment", methods=["POST"])
def public_verify_payment(token):
    invoice = Invoice.query.filter_by(public_token=token).first_or_404()
    reference = (request.get_json() or {}).get("reference")

    if not reference:
        return jsonify({"error": "reference is required"}), 400

    response = http.get(
        f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
        headers=_paystack_headers(),
        timeout=10,
    )

    if not response.ok:
        return jsonify({"error": "Could not verify payment"}), 502

    data = response.json()["data"]
    if data["status"] == "success":
        invoice.status = Invoice.STATUS_PAID
        db.session.commit()
        return jsonify({"paid": True})

    return jsonify({"paid": False, "status": data["status"]})
