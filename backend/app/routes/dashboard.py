from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func, text
from app import db
from app.models import Invoice, Client

dashboard_bp = Blueprint("dashboard", __name__)


def _user_id():
    return int(get_jwt_identity())


@dashboard_bp.route("/stats", methods=["GET"])
def get_stats():
    uid = _user_id()

    total_revenue = (
        db.session.query(func.sum(Invoice.total))
        .filter_by(user_id=uid, status=Invoice.STATUS_PAID).scalar() or 0
    )
    pending_amount = (
        db.session.query(func.sum(Invoice.total))
        .filter_by(user_id=uid, status=Invoice.STATUS_SENT).scalar() or 0
    )
    overdue_amount = (
        db.session.query(func.sum(Invoice.total))
        .filter_by(user_id=uid, status=Invoice.STATUS_OVERDUE).scalar() or 0
    )
    total_clients = Client.query.filter_by(user_id=uid).count()
    total_invoices = Invoice.query.filter_by(user_id=uid).count()

    by_status = (
        db.session.query(Invoice.status, func.count(Invoice.id))
        .filter_by(user_id=uid)
        .group_by(Invoice.status).all()
    )
    recent_invoices = (
        Invoice.query.filter_by(user_id=uid)
        .order_by(Invoice.created_at.desc()).limit(5).all()
    )

    return jsonify({
        "total_revenue": float(total_revenue),
        "pending_amount": float(pending_amount),
        "overdue_amount": float(overdue_amount),
        "total_clients": total_clients,
        "total_invoices": total_invoices,
        "by_status": {status: count for status, count in by_status},
        "recent_invoices": [inv.to_dict(include_items=False) for inv in recent_invoices],
    })


@dashboard_bp.route("/revenue-chart", methods=["GET"])
def revenue_chart():
    uid = _user_id()
    rows = db.session.execute(text("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS label,
            COALESCE(SUM(total), 0) AS revenue,
            COUNT(*) AS invoice_count
        FROM invoices
        WHERE status = 'paid'
          AND user_id = :uid
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
    """), {"uid": uid}).fetchall()

    return jsonify([
        {
            "month": row.month,
            "label": row.label,
            "revenue": float(row.revenue),
            "invoice_count": int(row.invoice_count),
        }
        for row in rows
    ])
