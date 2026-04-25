import os
import json
from flask import Blueprint, jsonify, request, render_template
from models import db, User, Task, Schedule
from datetime import datetime, timedelta
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

@bp.route("/api/verify-email", methods=["POST"])
def verify_email_config():
    """Endpoint to test SMTP configuration by sending a simple test email."""
    try:
        from extensions import mail
        from flask_mail import Message
        
        data = request.get_json()
        recipient = data.get("email")
        if not recipient:
            return jsonify({"error": "Recipient email is required."}), 400
            
        msg = Message(
            subject="🚀 TaskMaster: Test Email Connection",
            recipients=[recipient],
            body="Congratulations! Your SMTP configuration is working correctly. You will now receive task notifications.",
            html="<h3>🚀 TaskMaster: Connection Successful</h3><p>Your SMTP configuration is working correctly. You will now receive task notifications.</p>"
        )
        mail.send(msg)
        return jsonify({"message": f"Test email successfully sent to {recipient}"}), 200
    except Exception as e:
        logger.error(f"Test email failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

@bp.route("/api/debug-notifications", methods=["GET"])
def debug_notifications():
    """Temporary debug endpoint — shows today's date and all tasks for a user."""
    try:
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id required"}), 400
        try:
            user_id_int = int(user_id)
        except ValueError:
            return jsonify({"error": "user_id must be an integer"}), 400
        today_str = datetime.now().strftime("%Y-%m-%d")
        all_tasks = Task.query.filter_by(user_id=user_id_int, status="active").all()
        return jsonify({
            "today": today_str,
            "all_active_deadlines": [t.deadline for t in all_tasks],
            "matching_today": [t.deadline for t in all_tasks if t.deadline and t.deadline.startswith(today_str)]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route("/api/notifications", methods=["GET"])
def get_notifications():
    try:
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        try:
            user_id_int = int(user_id)
        except ValueError:
            return jsonify({"error": "user_id must be an integer"}), 400

        user = User.query.filter_by(id=user_id_int).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        today_str = datetime.now().strftime("%Y-%m-%d")

        # Fetch all active tasks for user then filter in Python
        # (avoids LIKE operator issues across SQLite/PostgreSQL)
        all_tasks = Task.query.filter_by(user_id=user_id_int, status="active").all()
        tasks = [t for t in all_tasks if t.deadline and t.deadline.startswith(today_str)]

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
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

    # Update status and completed_at
    if "status" in data:
        old_status = task.status
        new_status = data["status"]
        task.status = new_status
        
        if new_status == "completed" and old_status != "completed":
            task.completed_at = datetime.utcnow()
        elif new_status != "completed":
            task.completed_at = None
    
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

@bp.route("/api/test-email", methods=["POST"])
def test_email():
    """Test endpoint to manually trigger email notification"""
    from datetime import date
    from mail_service import send_notification_email
    
    data = request.get_json() or {}
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    
    try:
        user_id_int = int(user_id)
    except ValueError:
        return jsonify({"error": "user_id must be an integer"}), 400
    
    user = User.query.filter_by(id=user_id_int).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    today_str = date.today().isoformat()
    
    # Find tasks due today
    all_tasks = Task.query.filter_by(user_id=user_id_int, status="active").all()
    tasks = [t for t in all_tasks if t.deadline and t.deadline.startswith(today_str)]
    
    if not tasks:
        return jsonify({"message": "No tasks due today to send"}), 200
    
    # Score and sort tasks
    scored = []
    for task in tasks:
        result = calculate_priority_score(task.urgency, task.importance, task.severity, task.deadline)
        quadrant = get_eisenhower_quadrant(task.urgency, task.importance)
        scored.append({
            "title": task.title,
            "score": result["score"],
            "normalized": result["normalized"],
            "quadrant": quadrant,
            "deadline": task.deadline,
        })
    
    scored.sort(key=lambda d: d["score"], reverse=True)
    
    # Send email
    success = send_notification_email(user.email, user.name, scored)
    
    if success:
        return jsonify({
            "message": f"Email sent successfully to {user.email}",
            "tasks_count": len(scored)
        }), 200
    else:
        return jsonify({
            "error": "Failed to send email. Check SMTP configuration and Render logs."
        }), 500

@bp.route("/api/performance-metrics", methods=["GET"])
def get_performance_metrics():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400
    
    try:
        user_id_int = int(user_id)
        now = datetime.utcnow()
        three_days_ago = now - timedelta(days=3)
        
        # Define 3-day window tasks (due in the last 3 days)
        # We'll use tasks with deadlines between (today - 2) and today
        today_date = now.date()
        window_start = today_date - timedelta(days=2)
        window_end = today_date
        
        # Fetch all tasks for the user
        all_tasks = Task.query.filter_by(user_id=user_id_int).all()
        
        def get_ws(t):
            return (t.urgency * 0.3 + t.importance * 0.4 + t.severity * 0.3) * 10

        def parse_deadline(d_str):
            try:
                if 'T' in d_str: return datetime.fromisoformat(d_str.replace("Z", "+00:00")).replace(tzinfo=None)
                return datetime.strptime(d_str, "%Y-%m-%d")
            except: return None

        # 1. Completion & Agility
        # Tasks in the 3-day window (by deadline)
        window_tasks = []
        for t in all_tasks:
            d = parse_deadline(t.deadline)
            if d and window_start <= d.date() <= window_end:
                window_tasks.append(t)
        
        total_ws = sum(get_ws(t) for t in window_tasks)
        completed_ws = sum(get_ws(t) for t in window_tasks if t.status == "completed")
        
        completion = (completed_ws / total_ws * 300) if total_ws > 0 else 0
        agility = (len([t for t in window_tasks if t.status == "completed"]) / len(window_tasks) * 300) if window_tasks else 0

        # 2. Flexibility
        # Flex = 150 + EarlyBonus + SmartInterleave - SevereDelayPenalty
        # If no tasks exist at all, flex should be 0.
        flex = 150 if all_tasks else 0
        
        # Early Bonus & Severe Delay Penalty
        early_bonus = 0
        delay_penalty = 0
        penalty_count = 0
        
        completed_tasks = [t for t in all_tasks if t.status == "completed" and t.completed_at and t.completed_at >= three_days_ago]
        
        for t in completed_tasks:
            d = parse_deadline(t.deadline)
            if not d: continue
            
            ws = get_ws(t)
            
            # Early Bonus
            if t.completed_at.date() < d.date():
                days_early = (d.date() - t.completed_at.date()).days
                contribution = days_early * (ws / 100) * 15
                early_bonus += min(40, contribution)
            
            # Severe Delay Penalty
            if ws >= 80:
                days_late = (t.completed_at.date() - d.date()).days
                if days_late >= 2 and penalty_count < 4:
                    delay_penalty += 20
                    penalty_count += 1
        
        early_bonus = min(100, early_bonus)
        flex += early_bonus
        flex -= min(80, delay_penalty)
        
        # Smart Interleave
        # Pairs (A, B) where A completed before B, but A due after B.
        # A is smart: ws >= 70 or duration <= 60
        smart_bonus = 0
        pairs_count = 0
        
        # Sort by actual completion time
        sorted_completed = sorted(completed_tasks, key=lambda x: x.completed_at)
        
        for i in range(len(sorted_completed)):
            a = sorted_completed[i]
            a_due = parse_deadline(a.deadline)
            if not a_due: continue
            
            # Check if A is "smart"
            is_smart = get_ws(a) >= 70 or (a.duration_minutes and a.duration_minutes <= 60)
            if not is_smart: continue
            
            for j in range(i + 1, len(sorted_completed)):
                b = sorted_completed[j]
                b_due = parse_deadline(b.deadline)
                if not b_due: continue
                
                if a_due.date() > b_due.date():
                    pairs_count += 1
                    if pairs_count <= 20:
                        smart_bonus += 4
        
        flex += min(80, smart_bonus)
        flex = max(0, min(300, flex))

        return jsonify({
            "completion": round(completion, 1),
            "agility": round(agility, 1),
            "flex": round(flex, 1),
            "window": f"{window_start} to {window_end}"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
