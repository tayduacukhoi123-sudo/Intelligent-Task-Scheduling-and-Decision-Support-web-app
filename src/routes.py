from flask import Blueprint, jsonify, request
from models import db, User, Task, Schedule
from datetime import datetime

bp = Blueprint("main", __name__)

@bp.route("/")
def index():
    return jsonify({"message": "API active"})

@bp.route("/users", methods=["POST"])
def createUser():
    data = request.get_json()
    user = User(username=data["username"])
    db.session.add(user)
    db.session.commit()
    return jsonify({"id": user.id, "username": user.username}), 201

@bp.route("/tasks", methods=["POST"])
def create_task():
    data = request.get_json()
    task = Task(title=data["title"], user_id=data["user_id"])
    db.session.add(task)
    db.session.commit()
    return jsonify({"id": task.id, "title": task.title}), 201

@bp.route("/schedules", methods=["POST"])
def create_schedule():
    data = request.get_json()
    schedule = Schedule(
        task_id=data["task_id"],
        scheduled_time=datetime.fromisoformat(data["scheduled_time"]) if "scheduled_time" in data else None
    )
    db.session.add(schedule)
    db.session.commit()
    return jsonify({"id": schedule.id}), 201

@bp.route('/users/<int:user_id>')
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify({
        "id": user.id,
        "username": user.username,
        "tasks": [t.title for t in user.tasks]
    })