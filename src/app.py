from flask import Flask
from extensions import db, migrate
from models import User, Task, Schedule
from routes import bp

import os

def create_app(config_override=None):
    app = Flask(__name__)
    app.config.from_prefixed_env()
    app.config.setdefault("SQLALCHEMY_DATABASE_URI", os.getenv("DATABASE_URL", "sqlite:///database.db"))
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    
    db.init_app(app)
    migrate.init_app(app, db)
    
    app.register_blueprint(bp)
    
    with app.app_context():
        db.create_all()
    
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)