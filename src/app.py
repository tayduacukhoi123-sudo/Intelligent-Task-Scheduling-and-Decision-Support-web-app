from flask import Flask
from flask_cors import CORS
from extensions import db, migrate
from models import User, Task, Schedule
from routes import bp

import os

def create_app(config_override=None):
    app = Flask(__name__)
    app.config.from_prefixed_env()
    database_url = os.getenv("DATABASE_URL", "sqlite:///database.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
        
    app.config.setdefault("SQLALCHEMY_DATABASE_URI", database_url)
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    
    CORS(app)
    db.init_app(app)
    migrate.init_app(app, db)
    
    app.register_blueprint(bp)
    
    with app.app_context():
        db.create_all()
        # Simple migration for existing SQLite DBs
        try:
            from sqlalchemy import text
            db.session.execute(text('ALTER TABLE task ADD COLUMN tags TEXT'))
            db.session.commit()
        except:
            db.session.rollback()
    
    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)