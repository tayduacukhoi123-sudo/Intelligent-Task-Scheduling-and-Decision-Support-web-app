from flask import Flask
from flask_cors import CORS
from extensions import db, migrate, mail
from models import User, Task, Schedule
from routes import bp
from scheduler import init_scheduler

import logging
import os

logger = logging.getLogger(__name__)

def create_app(config_override=None):
    app = Flask(__name__)
    app.config.from_prefixed_env()
    database_url = os.getenv("DATABASE_URL", "sqlite:///database.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    app.config.setdefault("SQLALCHEMY_DATABASE_URI", database_url)
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)

    # SMTP / mail configuration
    mail_server = os.getenv("MAIL_SERVER")
    mail_port_raw = os.getenv("MAIL_PORT", "587")
    mail_use_tls_raw = os.getenv("MAIL_USE_TLS", "true")
    mail_username = os.getenv("MAIL_USERNAME")
    mail_password = os.getenv("MAIL_PASSWORD")
    mail_default_sender = os.getenv("MAIL_DEFAULT_SENDER")

    app.config["MAIL_SERVER"] = mail_server
    app.config["MAIL_PORT"] = int(mail_port_raw)
    app.config["MAIL_USE_TLS"] = mail_use_tls_raw.lower() == "true"
    app.config["MAIL_USERNAME"] = mail_username
    app.config["MAIL_PASSWORD"] = mail_password
    app.config["MAIL_DEFAULT_SENDER"] = mail_default_sender

    # Warn about missing required SMTP env vars
    if not mail_server:
        logger.warning("MAIL_SERVER env var is not set — email notifications will not work.")
    if not mail_username:
        logger.warning("MAIL_USERNAME env var is not set — email notifications will not work.")
    if not mail_password:
        logger.warning("MAIL_PASSWORD env var is not set — email notifications will not work.")

    CORS(app)
    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)
    init_scheduler(app)
    
    app.register_blueprint(bp)
    
    with app.app_context():
        db.create_all()
    
    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)