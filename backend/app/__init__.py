import os
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_mail import Mail
from flask_jwt_extended import JWTManager, verify_jwt_in_request
from .config import Config

db = SQLAlchemy()
migrate = Migrate()
mail = Mail()
jwt = JWTManager()


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)
    jwt.init_app(app)
    allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    CORS(app, resources={r"/api/*": {"origins": allowed}})

    from .routes.clients import clients_bp
    from .routes.invoices import invoices_bp
    from .routes.dashboard import dashboard_bp
    from .routes.settings import settings_bp
    from .routes.stripe_routes import payment_bp
    from .routes.auth import auth_bp
    from .routes.public import public_bp

    app.register_blueprint(clients_bp, url_prefix="/api/clients")
    app.register_blueprint(invoices_bp, url_prefix="/api/invoices")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(settings_bp, url_prefix="/api/settings")
    app.register_blueprint(payment_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(public_bp, url_prefix="/api/public")

    with app.app_context():
        db.create_all()

    PUBLIC_PREFIXES = ("/api/auth/", "/api/public/", "/api/webhooks/")

    @app.before_request
    def require_authentication():
        if request.method == "OPTIONS":
            return
        if any(request.path.startswith(p) for p in PUBLIC_PREFIXES):
            return
        if request.path.startswith("/api/"):
            try:
                verify_jwt_in_request()
            except Exception:
                return jsonify({"error": "Authentication required. Please log in."}), 401

    return app
