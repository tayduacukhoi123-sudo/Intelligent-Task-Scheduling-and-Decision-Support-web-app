"""
Extreme Performance Mock Data
Testing Gauges:
1. Completion: Mixed weight tasks (some done, some not)
2. Agility: High volume of tasks, mostly completed.
3. Flexibility: 
   - Early Bonus: Task finished 2 days early (+30 contribution)
   - Smart Interleave: Task A (ws=90) finished before Task B (due earlier)
   - Severe Delay: Task C (ws=95) finished 3 days late (-20 penalty)
"""
import os
from datetime import datetime, timedelta
from app import create_app
from models import db, User, Task

def seed_extreme_data():
    os.environ["DATABASE_URL"] = "postgresql://neondb_owner:npg_3MIokjFZY0Op@ep-dry-bird-amivmtzu-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    app = create_app()
    with app.app_context():
        users = User.query.all()
        for user in users:
            print(f"Seeding extreme gauge test data for: {user.email} (ID: {user.id})")
            Task.query.filter_by(user_id=user.id).delete()
            
            now = datetime.utcnow()
            def f_date(dt): return dt.strftime('%Y-%m-%dT%H:%M:%S')

            tasks_to_add = []
            
            # --- WINDOW: Last 3 Days ---
            d2_ago = now - timedelta(days=2)
            d1_ago = now - timedelta(days=1)
            
            # 1. Completion & Agility
            tasks_to_add.append({"title": "High Weight Done", "urgency": 10, "importance": 10, "severity": 10, "deadline": f_date(d2_ago), "status": "completed", "completed_at": d2_ago, "duration_minutes": 60})
            tasks_to_add.append({"title": "High Weight Done 2", "urgency": 10, "importance": 10, "severity": 10, "deadline": f_date(d1_ago), "status": "completed", "completed_at": d1_ago, "duration_minutes": 30})
            tasks_to_add.append({"title": "Low Weight Done", "urgency": 5, "importance": 5, "severity": 5, "deadline": f_date(now), "status": "completed", "completed_at": now, "duration_minutes": 30})
            tasks_to_add.append({"title": "Low Weight Done 2", "urgency": 5, "importance": 5, "severity": 5, "deadline": f_date(now), "status": "completed", "completed_at": now, "duration_minutes": 30})
            tasks_to_add.append({"title": "High Weight ACTIVE", "urgency": 10, "importance": 10, "severity": 10, "deadline": f_date(now), "status": "active", "duration_minutes": 60})

            # 2. Flexibility
            tasks_to_add.append({
                "title": "Early Bird (Bonus)", 
                "urgency": 8, "importance": 8, "severity": 8, 
                "deadline": f_date(now + timedelta(days=2)), 
                "status": "completed", "completed_at": now - timedelta(hours=5), 
                "duration_minutes": 60
            })
            tasks_to_add.append({
                "title": "Super Late (Penalty)", 
                "urgency": 9, "importance": 9, "severity": 9, 
                "deadline": f_date(now - timedelta(days=3)), 
                "status": "completed", "completed_at": now - timedelta(minutes=10), 
                "duration_minutes": 120
            })
            tasks_to_add.append({
                "title": "Smart Task A", 
                "urgency": 7, "importance": 8, "severity": 7, 
                "deadline": f_date(now + timedelta(days=2)), 
                "status": "completed", "completed_at": now - timedelta(days=1), 
                "duration_minutes": 45
            })
            tasks_to_add.append({
                "title": "Earlier Task B", 
                "urgency": 5, "importance": 5, "severity": 5, 
                "deadline": f_date(now), 
                "status": "completed", "completed_at": now - timedelta(hours=1), 
                "duration_minutes": 60
            })

            for t_data in tasks_to_add:
                comp_at = t_data.pop('completed_at', None)
                task = Task(user_id=user.id, **t_data)
                task.completed_at = comp_at
                db.session.add(task)
            
            db.session.commit()
            print(f"Committed tasks for {user.email}")
        print(f"Successfully seeded extreme performance tasks.")

if __name__ == "__main__":
    seed_extreme_data()
