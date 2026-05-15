from flask import Blueprint, jsonify, request
from app import db
from app.models import BusinessProfile

settings_bp = Blueprint("settings", __name__)


@settings_bp.route("", methods=["GET"])
def get_settings():
    profile = BusinessProfile.get_or_create()
    return jsonify(profile.to_dict())


@settings_bp.route("", methods=["PUT"])
def update_settings():
    profile = BusinessProfile.get_or_create()
    data = request.get_json() or {}

    fields = [
        "business_name", "business_email", "business_phone",
        "business_address", "logo_url", "currency",
    ]
    for field in fields:
        if field in data:
            setattr(profile, field, data[field])

    if "default_tax_rate" in data:
        profile.default_tax_rate = float(data["default_tax_rate"])

    db.session.commit()
    return jsonify(profile.to_dict())
