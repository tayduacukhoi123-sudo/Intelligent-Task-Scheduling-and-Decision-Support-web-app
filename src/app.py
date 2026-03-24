from flask import Flask
from extensions import db, migrate
from models import User, Task, Schedule
from routes import bp

def createApp(configOverride=None):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = "iDJJRdEj5PpL7FZWbiJh9Lcgb5tzet6k-5H987TXGnIiwD1lWy017E8W5uhWhFvau-lzSeIjfn"
    
    if configOverride:
        app.config.update(configOverride)
    
    db.init_app(app)
    migrate.init_app(app, db)
    
    app.register_blueprint(bp)
    
    with app.app_context():
        db.create_all()
    
    return app

if __name__ == "__main__":
    app = createApp()
    app.run(debug=True)