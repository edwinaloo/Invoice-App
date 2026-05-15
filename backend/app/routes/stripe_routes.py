import os
import hmac
import hashlib
import uuid
import requests as http
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app import db
from app.models import Invoice

payment_bp = Blueprint("payment", __name__)

PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY", "")
PAYSTACK_BASE_URL = "https://api.paystack.co"
PAYSTACK_CURRENCY = os.environ.get("PAYSTACK_CURRENCY", "USD")


def _headers():
    return {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


@payment_bp.route("/invoices/<int:invoice_id>/checkout-session", methods=["POST"])
def initialize_payment(invoice_id):
    uid = int(get_jwt_identity())
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()

    if invoice.status == Invoice.STATUS_PAID:
        return jsonify({"error": "This invoice is already paid"}), 400

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    reference = f"INV-{invoice.id}-{uuid.uuid4().hex[:10]}"

    # Paystack expects amount in the smallest currency unit (e.g. kobo, pesewas, cents)
    amount_minor = int(float(invoice.total) * 100)

    payload = {
        "email": invoice.client.email,
        "amount": amount_minor,
        "currency": PAYSTACK_CURRENCY,
        "reference": reference,
        "callback_url": f"{frontend_url}/invoices/{invoice.id}?reference={reference}",
        "metadata": {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "client_name": invoice.client.name,
        },
    }

    response = http.post(
        f"{PAYSTACK_BASE_URL}/transaction/initialize",
        json=payload,
        headers=_headers(),
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


@payment_bp.route("/invoices/<int:invoice_id>/verify-payment", methods=["POST"])
def verify_payment(invoice_id):
    uid = int(get_jwt_identity())
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()
    body = request.get_json() or {}
    reference = body.get("reference")

    if not reference:
        return jsonify({"error": "reference is required"}), 400

    response = http.get(
        f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
        headers=_headers(),
        timeout=10,
    )

    if not response.ok:
        return jsonify({"error": "Could not verify payment with Paystack"}), 502

    data = response.json()["data"]

    if data["status"] == "success":
        invoice.status = Invoice.STATUS_PAID
        db.session.commit()
        return jsonify({"paid": True, "invoice": invoice.to_dict(include_items=False)})

    return jsonify({"paid": False, "status": data["status"]})


@payment_bp.route("/webhooks/paystack", methods=["POST"])
def paystack_webhook():
    paystack_sig = request.headers.get("x-paystack-signature", "")
    payload = request.get_data()
    computed = hmac.new(
        PAYSTACK_SECRET_KEY.encode(), payload, hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(computed, paystack_sig):
        return jsonify({"error": "Invalid signature"}), 400

    event = request.get_json(silent=True) or {}

    if event.get("event") == "charge.success":
        invoice_id = event.get("data", {}).get("metadata", {}).get("invoice_id")
        if invoice_id:
            invoice = Invoice.query.get(int(invoice_id))
            if invoice and invoice.status != Invoice.STATUS_PAID:
                invoice.status = Invoice.STATUS_PAID
                db.session.commit()

    return jsonify({"received": True})
