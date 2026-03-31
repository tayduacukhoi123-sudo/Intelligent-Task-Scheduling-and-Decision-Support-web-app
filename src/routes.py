import os
from flask import Blueprint, jsonify, request, render_template
from models import db, User, Task, Schedule
from datetime import datetime
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

bp = Blueprint("main", __name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# --- Frontend Routes ---
@bp.route("/")
@bp.route("/index.html")
def index():
    return render_template("index.html")

@bp.route("/login.html")
def login_page():
    return render_template("login.html")

@bp.route("/task.html")
def task_page():
    return render_template("task.html")

@bp.route("/schedule.html")
def schedule_page():
    return render_template("schedule.html")

@bp.route("/history.html")
def history_page():
    return render_template("history.html")

# --- API Routes ---
@bp.route("/api/auth/google", methods=["POST"])
def auth_google():
    data = request.get_json()
    token = data.get("credential")
    if not token:
        return jsonify({"error": "No credential provided"}), 400

    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        name = idinfo.get('name', 'User')

        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(email=email, name=name)
            db.session.add(user)
            db.session.commit()

        return jsonify({"user_id": user.id, "email": user.email, "name": user.name}), 200
    except ValueError:
        return jsonify({"error": "Invalid token"}), 401

@bp.route("/api/tasks", methods=["GET"])
def get_tasks():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    
    tasks = Task.query.filter_by(user_id=user_id).all()
    task_list = []
    for t in tasks:
        task_list.append({
            "id": t.id,
            "title": t.title,
            "urgency": t.urgency,
            "importance": t.importance,
            "severity": t.severity,
            "deadline": t.deadline,
            "status": t.status,
            "createdAt": t.created_at.isoformat()
        })
    return jsonify(task_list), 200

@bp.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
        
    task = Task(
        title=data.get("title", ""),
        user_id=user_id,
        urgency=data.get("urgency", 1),
        importance=data.get("importance", 1),
        severity=data.get("severity", 1),
        deadline=data.get("deadline", "")
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"id": task.id, "title": task.title}), 201

@bp.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.get_json()
    task = Task.query.get_or_404(task_id)
    
    # Update status
    if "status" in data:
        task.status = data["status"]
    
    # Update other fields (Title, U, I, S, Deadline)
    if "title" in data: task.title = data["title"]
    if "urgency" in data: task.urgency = data["urgency"]
    if "importance" in data: task.importance = data["importance"]
    if "severity" in data: task.severity = data["severity"]
    if "deadline" in data: task.deadline = data["deadline"]
    
    db.session.commit()
    return jsonify({"id": task.id, "status": task.status, "title": task.title}), 200

@bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted successfully"}), 200