import os
from datetime import date
from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity
from app import db
from app.models import Invoice, InvoiceItem, Client, BusinessProfile
from app.utils.pdf_generator import generate_invoice_pdf
from app.utils.email_sender import send_invoice_email
import io

invoices_bp = Blueprint("invoices", __name__)


def _user_id():
    return int(get_jwt_identity())


def _auto_mark_overdue(uid):
    today = date.today()
    Invoice.query.filter(
        Invoice.user_id == uid,
        Invoice.status == Invoice.STATUS_SENT,
        Invoice.due_date < today,
    ).update({"status": Invoice.STATUS_OVERDUE}, synchronize_session=False)
    db.session.commit()


def _next_invoice_number(uid):
    last = Invoice.query.filter_by(user_id=uid).order_by(Invoice.id.desc()).first()
    if last:
        try:
            num = int(last.invoice_number.replace("INV-", "")) + 1
        except ValueError:
            num = last.id + 1
    else:
        num = 1001
    return f"INV-{num:04d}"


@invoices_bp.route("", methods=["GET"])
def get_invoices():
    uid = _user_id()
    _auto_mark_overdue(uid)
    status = request.args.get("status")
    query = Invoice.query.filter_by(user_id=uid)
    if status:
        query = query.filter_by(status=status)
    invoices = query.order_by(Invoice.created_at.desc()).all()
    return jsonify([inv.to_dict(include_items=False) for inv in invoices])


@invoices_bp.route("/<int:invoice_id>", methods=["GET"])
def get_invoice(invoice_id):
    uid = _user_id()
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()
    if invoice.status == Invoice.STATUS_SENT and invoice.due_date < date.today():
        invoice.status = Invoice.STATUS_OVERDUE
        db.session.commit()
    return jsonify(invoice.to_dict())


@invoices_bp.route("", methods=["POST"])
def create_invoice():
    uid = _user_id()
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    client = Client.query.filter_by(id=data.get("client_id"), user_id=uid).first()
    if not client:
        return jsonify({"error": "Client not found"}), 404

    try:
        issue_date = date.fromisoformat(data["issue_date"])
        due_date = date.fromisoformat(data["due_date"])
    except (KeyError, ValueError):
        return jsonify({"error": "Valid issue_date and due_date are required (YYYY-MM-DD)"}), 400

    invoice = Invoice(
        user_id=uid,
        invoice_number=_next_invoice_number(uid),
        client_id=data["client_id"],
        status=Invoice.STATUS_DRAFT,
        issue_date=issue_date,
        due_date=due_date,
        notes=data.get("notes", ""),
        tax_rate=data.get("tax_rate", 0),
    )
    db.session.add(invoice)
    db.session.flush()

    for item_data in data.get("items", []):
        item = InvoiceItem(
            invoice_id=invoice.id,
            description=item_data["description"],
            quantity=item_data.get("quantity", 1),
            unit_price=item_data.get("unit_price", 0),
        )
        item.calculate_amount()
        db.session.add(item)

    db.session.flush()
    invoice.recalculate_totals()
    db.session.commit()
    return jsonify(invoice.to_dict()), 201


@invoices_bp.route("/<int:invoice_id>", methods=["PUT"])
def update_invoice(invoice_id):
    uid = _user_id()
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()
    data = request.get_json()

    if "client_id" in data:
        client = Client.query.filter_by(id=data["client_id"], user_id=uid).first()
        if not client:
            return jsonify({"error": "Client not found"}), 404
        invoice.client_id = data["client_id"]

    if "issue_date" in data:
        invoice.issue_date = date.fromisoformat(data["issue_date"])
    if "due_date" in data:
        invoice.due_date = date.fromisoformat(data["due_date"])
    if "notes" in data:
        invoice.notes = data["notes"]
    if "tax_rate" in data:
        invoice.tax_rate = data["tax_rate"]

    if "items" in data:
        for item in invoice.items:
            db.session.delete(item)
        db.session.flush()
        for item_data in data["items"]:
            item = InvoiceItem(
                invoice_id=invoice.id,
                description=item_data["description"],
                quantity=item_data.get("quantity", 1),
                unit_price=item_data.get("unit_price", 0),
            )
            item.calculate_amount()
            db.session.add(item)
        db.session.flush()

    invoice.recalculate_totals()
    db.session.commit()
    return jsonify(invoice.to_dict())


@invoices_bp.route("/<int:invoice_id>/status", methods=["PATCH"])
def update_status(invoice_id):
    uid = _user_id()
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()
    data = request.get_json()
    new_status = data.get("status")
    if new_status not in Invoice.VALID_STATUSES:
        return jsonify({"error": f"Invalid status. Must be one of: {Invoice.VALID_STATUSES}"}), 400
    invoice.status = new_status
    db.session.commit()
    return jsonify(invoice.to_dict(include_items=False))


@invoices_bp.route("/<int:invoice_id>", methods=["DELETE"])
def delete_invoice(invoice_id):
    uid = _user_id()
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()
    db.session.delete(invoice)
    db.session.commit()
    return jsonify({"message": "Invoice deleted"}), 200


@invoices_bp.route("/<int:invoice_id>/pdf", methods=["GET"])
def download_pdf(invoice_id):
    uid = _user_id()
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()
    profile = BusinessProfile.get_or_create().to_dict()
    pdf_bytes = generate_invoice_pdf(invoice, profile)
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{invoice.invoice_number}.pdf",
    )


@invoices_bp.route("/<int:invoice_id>/share", methods=["POST"])
def share_invoice(invoice_id):
    uid = _user_id()
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()
    token = invoice.get_or_create_public_token()
    db.session.commit()
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    return jsonify({
        "token": token,
        "url": f"{frontend_url}/pay/{token}",
    })


@invoices_bp.route("/<int:invoice_id>/send-email", methods=["POST"])
def send_email(invoice_id):
    uid = _user_id()
    invoice = Invoice.query.filter_by(id=invoice_id, user_id=uid).first_or_404()
    profile = BusinessProfile.get_or_create()
    try:
        send_invoice_email(invoice, profile)
        if invoice.status == Invoice.STATUS_DRAFT:
            invoice.status = Invoice.STATUS_SENT
            db.session.commit()
        return jsonify({"message": f"Invoice sent to {invoice.client.email}"})
    except Exception as e:
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500
