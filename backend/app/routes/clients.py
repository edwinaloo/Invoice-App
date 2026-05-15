from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from app import db
from app.models import Client

clients_bp = Blueprint("clients", __name__)


def _user_id():
    return int(get_jwt_identity())


@clients_bp.route("", methods=["GET"])
def get_clients():
    uid = _user_id()
    clients = Client.query.filter_by(user_id=uid).order_by(Client.name).all()
    return jsonify([c.to_dict() for c in clients])


@clients_bp.route("/<int:client_id>", methods=["GET"])
def get_client(client_id):
    uid = _user_id()
    client = Client.query.filter_by(id=client_id, user_id=uid).first_or_404()
    return jsonify(client.to_dict())


@clients_bp.route("", methods=["POST"])
def create_client():
    uid = _user_id()
    data = request.get_json()
    if not data or not data.get("name") or not data.get("email"):
        return jsonify({"error": "name and email are required"}), 400

    if Client.query.filter_by(email=data["email"], user_id=uid).first():
        return jsonify({"error": "A client with this email already exists"}), 409

    client = Client(
        user_id=uid,
        name=data["name"],
        email=data["email"],
        phone=data.get("phone"),
        company=data.get("company"),
        address=data.get("address"),
    )
    db.session.add(client)
    db.session.commit()
    return jsonify(client.to_dict()), 201


@clients_bp.route("/<int:client_id>", methods=["PUT"])
def update_client(client_id):
    uid = _user_id()
    client = Client.query.filter_by(id=client_id, user_id=uid).first_or_404()
    data = request.get_json()

    if "name" in data:
        client.name = data["name"]
    if "email" in data:
        existing = Client.query.filter_by(email=data["email"], user_id=uid).first()
        if existing and existing.id != client_id:
            return jsonify({"error": "A client with this email already exists"}), 409
        client.email = data["email"]
    if "phone" in data:
        client.phone = data["phone"]
    if "company" in data:
        client.company = data["company"]
    if "address" in data:
        client.address = data["address"]

    db.session.commit()
    return jsonify(client.to_dict())


@clients_bp.route("/<int:client_id>", methods=["DELETE"])
def delete_client(client_id):
    uid = _user_id()
    client = Client.query.filter_by(id=client_id, user_id=uid).first_or_404()
    db.session.delete(client)
    db.session.commit()
    return jsonify({"message": "Client deleted"}), 200
