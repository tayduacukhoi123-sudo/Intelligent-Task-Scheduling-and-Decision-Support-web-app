from datetime import datetime
from extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    tasks = db.relationship("Task", backref="user", lazy=True)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    
    urgency = db.Column(db.Integer, nullable=False, default=1)
    importance = db.Column(db.Integer, nullable=False, default=1)
    severity = db.Column(db.Integer, nullable=False, default=1)
    deadline = db.Column(db.String(50), nullable=False) # Store YYYY-MM-DD as string for simplicity, or Date
    duration_minutes = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='active')
    tags = db.Column(db.Text, nullable=True) # JSON stored as string: [{"name":"Work", "color":"blue"}]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_notified = db.Column(db.Boolean, nullable=False, default=False)
    
    schedules = db.relationship("Schedule", backref="task", lazy=True, cascade="all, delete-orphan")

class Schedule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    scheduled_time = db.Column(db.DateTime, default=datetime.utcnow)
    task_id = db.Column(db.Integer, db.ForeignKey("task.id"), nullable=False)