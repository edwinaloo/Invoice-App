from app import db


class BusinessProfile(db.Model):
    __tablename__ = "business_profile"

    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(200), default="My Business")
    business_email = db.Column(db.String(200))
    business_phone = db.Column(db.String(50))
    business_address = db.Column(db.Text)
    logo_url = db.Column(db.String(500))
    default_tax_rate = db.Column(db.Numeric(5, 2), default=0)
    currency = db.Column(db.String(10), default="KES")

    @classmethod
    def get_or_create(cls):
        profile = cls.query.first()
        if not profile:
            profile = cls()
            db.session.add(profile)
            db.session.commit()
        return profile

    def to_dict(self):
        return {
            "business_name": self.business_name or "",
            "business_email": self.business_email or "",
            "business_phone": self.business_phone or "",
            "business_address": self.business_address or "",
            "logo_url": self.logo_url or "",
            "default_tax_rate": float(self.default_tax_rate or 0),
            "currency": self.currency or "KES",
        }
