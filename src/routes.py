import os
import json
from flask import Blueprint, jsonify, request, render_template
from models import db, User, Task, Schedule
from datetime import datetime
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google import genai
from google.genai import types
from algorithm import calculate_priority_score, get_eisenhower_quadrant

bp = Blueprint("main", __name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

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

@bp.route("/api/parse-task", methods=["POST"])
def parse_task():
    if not client:
        return jsonify({"error": "Gemini API key not configured"}), 500
    
    data = request.get_json() or {}
    text = data.get("text", "")
    existing_tasks = data.get("existing_tasks", [])
    
    if not text:
        return jsonify({"error": "Text is required"}), 400
    
    current_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    
    # Format existing tasks for AI context (including IDs)
    tasks_context = ""
    if existing_tasks:
        tasks_context = "\nExisting Tasks for Context (IDs included for optimization):\n" + "\n".join([
            f"- [ID: {t.get('id')}] {t['title']} from {t['start_time']} for {t['duration_minutes']} mins (Urgency: {t.get('urgency')}, Importance: {t.get('importance')})"
            for t in existing_tasks
        ])

    # Get existing tags for this user to help AI deduplicate
    user_id = data.get("user_id")
    existing_tags_str = "[]"
    if user_id:
        user_tasks = Task.query.filter_by(user_id=user_id).all()
        tags_set = set()
        for ut in user_tasks:
            if ut.tags:
                try:
                    for tag in json.loads(ut.tags):
                        tags_set.add(tag['name'])
                except: pass
        existing_tags_str = json.dumps(list(tags_set))

    system_prompt = f"""
    You are a high-performance schedule optimization AI. Your goal is to convert natural language into a JSON task object and optimize the user's schedule.
    
    Current Time Context: {current_time}
    {tasks_context}
    
    Output JSON Schema:
    {{
      "title": "Clear, actionable task title",
      "start_time": "ISO8601 string resolved from the prompt.",
      "duration_minutes": "Estimated duration in minutes (integer).",
      "urgency": "Integer 1-10 (How soon does this need to be done? 10=Immediate, 1=No rush)",
      "importance": "Integer 1-10 (How much long-term value does this have? 10=Critical goal, 1=Minor task)",
      "tags": [{{ "name": "Work", "color": "blue" }}, {{ "name": "DeepWork", "color": "purple" }}],
      "conflict_note": "Summary of any overlap.",
      "suggested_time": "A free ISO8601 time slot for the NEW task if it clashes (string, optional).",
      "reschedule_proposal": {{
         "task_id": "ID of an EXISTING task to move (integer, optional)",
         "task_title": "Title of the task to move (string, optional)",
         "new_start_time": "New ISO8601 time for the existing task (string, optional)"
      }}
    }}
    
    Tag Extraction & Taxonomy Rules:
    1. Limit: Generate exactly 2-3 tags per task.
    2. Hybrid Taxonomy: Use the user's existing tags where semantic matches exist. Existing tags: {existing_tags_str}. 
       If confidence for an existing tag matching is < 70%, create a NEW Custom Tag.
    3. Contextual "Mood" & "Energy": 
       - #DeepWork (for tasks > 90 mins)
       - #QuickWin (for tasks < 15 mins)
       - #HighEnergy (strategic, meetings) vs #LowEnergy (admin, expenses)
    4. Avoid Noun-Hoarding: Focus on Action (e.g., #Communication) and Context (e.g., #ParisProject) rather than generic nouns.
    5. Automatic Color Logic:
       - Warm (red, orange): High urgency tasks.
       - Cool (blue, purple): Creative, Schedule (Q2), or focus tasks.
    6. Implicit Tagging: Add category tags like #Development even if the word isn't in the input (e.g. for "Fix bug").

    Eisenhower Matrix Guidance:
    - DO FIRST (Q1): High Urgency (>=6) AND High Importance (>=6)
    - SCHEDULE (Q2): Low Urgency (<6) AND High Importance (>=6)
    - DELEGATE (Q3): High Urgency (>=6) AND Low Importance (<6)
    - ELIMINATE (Q4): Low Urgency (<6) AND Low Importance (<6)
    
    Optimization Rules:
    1. Resolve relative dates like 'tomorrow' using the Reference Time.
    2. Analyze 'Existing Tasks' for overlaps.
    3. If there is a CLASH:
       - Determine if it's better to move the NEW task OR an EXISTING task to another free slot.
       - If an EXISTING task should be moved to make room, provide details in 'reschedule_proposal'.
       - Explain your logic in 'conflict_note'.
    
    IMPORTANT: Provide ANY rescheduling in 'reschedule_proposal'. Return ONLY raw JSON.
    """
    
    try:
        if not client:
            # Enhanced mock remains for safety
            import datetime as dt
            parsed = {
                "title": text.title(),
                "start_time": (datetime.now() + dt.timedelta(days=1)).replace(hour=9, minute=0, second=0).isoformat(),
                "duration_minutes": 30,
                "priority": 2
            }
            return jsonify(parsed), 200

        response = client.models.generate_content(
            model="gemma-4-31b-it",
            contents=text,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
            )
        )
        
        resp_text = response.text.strip()
        if resp_text.startswith("```"):
            resp_text = resp_text.split("\n", 1)[1].rsplit("\n", 1)[0]
        
        parsed = json.loads(resp_text)
        return jsonify(parsed), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/api/notifications", methods=["GET"])
def get_notifications():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    today_str = datetime.now().strftime("%Y-%m-%d")
    tasks = Task.query.filter(
        Task.user_id == user_id,
        Task.deadline.like(f"{today_str}%"),
        Task.status == "active"
    ).all()

    result = []
    for t in tasks:
        score_data = calculate_priority_score(t.urgency, t.importance, t.severity, t.deadline)
        quadrant = get_eisenhower_quadrant(t.urgency, t.importance)
        result.append({
            "id": t.id,
            "title": t.title,
            "urgency": t.urgency,
            "importance": t.importance,
            "severity": t.severity,
            "deadline": t.deadline,
            "score": score_data["score"],
            "normalized_score": score_data["normalized"],
            "quadrant": quadrant,
            "tags": json.loads(t.tags) if t.tags else [],
            "is_notified": t.is_notified,
        })

    return jsonify(result), 200


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
            "duration_minutes": t.duration_minutes,
            "tags": json.loads(t.tags) if t.tags else [],
            "status": t.status,
            "createdAt": t.created_at.isoformat()
        })
    return jsonify(task_list), 200

@bp.route("/api/tasks/<int:task_id>", methods=["GET"])
def get_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found."}), 404
    return jsonify({
        "id": task.id,
        "title": task.title,
        "urgency": task.urgency,
        "importance": task.importance,
        "severity": task.severity,
        "deadline": task.deadline,
        "duration_minutes": task.duration_minutes,
        "tags": json.loads(task.tags) if task.tags else [],
        "status": task.status
    }), 200

def validate_task_fields(data, is_create=False):
    """Shared validation for create and update operations."""
    errors = []

    # Title validation
    if is_create or "title" in data:
        title = data.get("title", "").strip()
        if not title:
            errors.append("Task title is required.")
        elif len(title) < 3:
            errors.append("Task title must be at least 3 characters long.")
        elif len(title) > 100:
            errors.append("Task title must be at most 100 characters.")

    # Score validations (urgency, importance, severity must be 1-10)
    for field in ["urgency", "importance", "severity"]:
        if is_create or field in data:
            val = data.get(field)
            try:
                val = int(val)
            except (TypeError, ValueError):
                errors.append(f"{field.capitalize()} must be an integer.")
                continue
            if val < 1 or val > 10:
                errors.append(f"{field.capitalize()} must be between 1 and 10.")

    # Deadline validation
    if is_create or "deadline" in data:
        deadline = data.get("deadline", "")
        if not deadline:
            errors.append("Deadline is required.")
        else:
            try:
                # Support ISO8601 (including AI format) and simple YYYY-MM-DD
                try:
                    # fromisoformat handles T, seconds, etc.
                    dt = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
                except ValueError:
                    dt = datetime.strptime(deadline, "%Y-%m-%d")
                
                # Block past dates ONLY on CREATE
                if is_create:
                    # Use local time to match AI context and user's timezone
                    now = datetime.now()
                    if dt < now:
                        errors.append("Deadline cannot be in the past.")
                
                # Block ridiculously far dates (e.g. > 10 years)
                if dt.year > datetime.utcnow().year + 10:
                    errors.append("Deadline is too far in the future.")
            except ValueError:
                errors.append("Deadline must be a valid date in YYYY-MM-DD or YYYY-MM-DDTHH:MM format.")

    # Duration validation
    if "duration_minutes" in data and data["duration_minutes"] is not None:
        try:
            dur = int(data["duration_minutes"])
            if dur < 0:
                errors.append("Duration cannot be negative.")
        except (TypeError, ValueError):
            errors.append("Duration must be an integer.")

    return errors

@bp.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required."}), 400

    # Verify user exists
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    # Validate fields
    errors = validate_task_fields(data, is_create=True)
    if errors:
        return jsonify({"error": errors[0], "errors": errors}), 422
        
    task = Task(
        title=data.get("title", "").strip(),
        user_id=user_id,
        urgency=int(data.get("urgency", 1)),
        importance=int(data.get("importance", 1)),
        severity=int(data.get("severity", 1)),
        deadline=data.get("deadline", ""),
        duration_minutes=data.get("duration_minutes"),
        tags=json.dumps(data.get("tags", [])) if data.get("tags") else "[]"
    )
    db.session.add(task)
    db.session.commit()
    return jsonify({"id": task.id, "title": task.title}), 201

@bp.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found."}), 404
    
    # Validate fields
    errors = validate_task_fields(data, is_create=False)
    if errors:
        return jsonify({"error": errors[0], "errors": errors}), 422

    # Update status
    if "status" in data:
        task.status = data["status"]
    
    # Update other fields
    if "title" in data: task.title = data["title"].strip()
    if "urgency" in data: task.urgency = int(data["urgency"])
    if "importance" in data: task.importance = int(data["importance"])
    if "severity" in data: task.severity = int(data["severity"])
    if "deadline" in data: task.deadline = data["deadline"]
    if "duration_minutes" in data: task.duration_minutes = data["duration_minutes"]
    if "tags" in data: task.tags = json.dumps(data["tags"])
    
    db.session.commit()
    return jsonify({"id": task.id, "status": task.status, "title": task.title}), 200

@bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return jsonify({"error": "Task not found."}), 404
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted successfully"}), 200

@bp.route("/api/tasks/history", methods=["DELETE"])
def clear_history():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    
    completed = Task.query.filter_by(user_id=user_id, status="completed").all()
    count = len(completed)
    for task in completed:
        db.session.delete(task)
    db.session.commit()
    return jsonify({"message": f"Cleared {count} completed tasks"}), 200
