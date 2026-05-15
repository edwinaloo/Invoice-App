import secrets
from datetime import datetime, timezone
from app import db


class Invoice(db.Model):
    __tablename__ = "invoices"

    STATUS_DRAFT = "draft"
    STATUS_SENT = "sent"
    STATUS_PAID = "paid"
    STATUS_OVERDUE = "overdue"
    VALID_STATUSES = [STATUS_DRAFT, STATUS_SENT, STATUS_PAID, STATUS_OVERDUE]

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    invoice_number = db.Column(db.String(50), nullable=False, unique=True)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=STATUS_DRAFT)
    issue_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    notes = db.Column(db.Text)
    tax_rate = db.Column(db.Numeric(5, 2), default=0)
    subtotal = db.Column(db.Numeric(12, 2), default=0)
    tax_amount = db.Column(db.Numeric(12, 2), default=0)
    total = db.Column(db.Numeric(12, 2), default=0)
    payment_reference = db.Column(db.String(200), nullable=True)
    public_token = db.Column(db.String(64), nullable=True, unique=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    client = db.relationship("Client", back_populates="invoices")
    items = db.relationship(
        "InvoiceItem", back_populates="invoice", cascade="all, delete-orphan"
    )

    def get_or_create_public_token(self) -> str:
        if not self.public_token:
            self.public_token = secrets.token_urlsafe(32)
        return self.public_token

    def recalculate_totals(self):
        self.subtotal = sum(item.amount for item in self.items)
        self.tax_amount = self.subtotal * (self.tax_rate / 100)
        self.total = self.subtotal + self.tax_amount

    def to_dict(self, include_items=True):
        data = {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "client_id": self.client_id,
            "client": self.client.to_dict() if self.client else None,
            "status": self.status,
            "issue_date": self.issue_date.isoformat(),
            "due_date": self.due_date.isoformat(),
            "notes": self.notes,
            "tax_rate": float(self.tax_rate),
            "subtotal": float(self.subtotal),
            "tax_amount": float(self.tax_amount),
            "total": float(self.total),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "payment_reference": self.payment_reference,
            "public_token": self.public_token,
        }
        if include_items:
            data["items"] = [item.to_dict() for item in self.items]
        return data
