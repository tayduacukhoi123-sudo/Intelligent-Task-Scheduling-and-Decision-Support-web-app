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
    app = create_app()
    with app.app_context():
        # Get user from command line or default
        email = os.getenv("TEST_USER_EMAIL", "tayduacukhoi123@gmail.com")
        user = User.query.filter_by(email=email).first()
        if not user:
            print(f"User {email} not found.")
            return
        
        print(f"Seeding extreme gauge test data for: {user.email}")
        Task.query.filter_by(user_id=user.id).delete()
        
        now = datetime.utcnow()
        def f_date(dt): return dt.strftime('%Y-%m-%d %H:%M:%S')

        tasks = []
        
        # --- WINDOW: Last 3 Days ---
        # (Deadlines between today-2 and today)
        d2_ago = now - timedelta(days=2)
        d1_ago = now - timedelta(days=1)
        
        # 1. Completion & Agility Testing (Window Tasks)
        # 5 tasks in window, 4 completed = 80% Agility
        # Weighted Completion:
        # T1: WS=100 (Done)
        # T2: WS=100 (Done)
        # T3: WS=50 (Done)
        # T4: WS=50 (Done)
        # T5: WS=100 (NOT Done)
        # Total WS = 400. Completed WS = 300. Completion = 300/400 = 75% -> 225/300
        tasks.append({"title": "High Weight Done", "urgency": 10, "importance": 10, "severity": 10, "deadline": f_date(d2_ago), "status": "completed", "completed_at": d2_ago, "duration_minutes": 60})
        tasks.append({"title": "High Weight Done 2", "urgency": 10, "importance": 10, "severity": 10, "deadline": f_date(d1_ago), "status": "completed", "completed_at": d1_ago, "duration_minutes": 30})
        tasks.append({"title": "Low Weight Done", "urgency": 5, "importance": 5, "severity": 5, "deadline": f_date(now), "status": "completed", "completed_at": now, "duration_minutes": 30})
        tasks.append({"title": "Low Weight Done 2", "urgency": 5, "importance": 5, "severity": 5, "deadline": f_date(now), "status": "completed", "completed_at": now, "duration_minutes": 30})
        tasks.append({"title": "High Weight ACTIVE", "urgency": 10, "importance": 10, "severity": 10, "deadline": f_date(now), "status": "active", "duration_minutes": 60})

        # 2. Flexibility Testing (Bonuses & Penalties)
        # Early Bonus: Finished 2 days before deadline
        # ws = 80. days_early = 2. contribution = 2 * (80/100) * 15 = 24 bonus points.
        tasks.append({
            "title": "Early Bird (Bonus)", 
            "urgency": 8, "importance": 8, "severity": 8, 
            "deadline": f_date(now + timedelta(days=2)), 
            "status": "completed", "completed_at": now - timedelta(hours=5), 
            "duration_minutes": 60
        })

        # Severe Delay Penalty: ws >= 80, 2+ days late
        # ws = 90. deadline = 3 days ago. completed = now.
        # Penalty = -20.
        tasks.append({
            "title": "Super Late (Penalty)", 
            "urgency": 9, "importance": 9, "severity": 9, 
            "deadline": f_date(now - timedelta(days=3)), 
            "status": "completed", "completed_at": now - timedelta(minutes=10), 
            "duration_minutes": 120
        })

        # Smart Interleave: Task A (ws>=70) done before Task B (due earlier)
        # Task A: Due in 2 days, Done Yesterday. (Smart: ws=75)
        # Task B: Due Today, Done Today.
        tasks.append({
            "title": "Smart Task A", 
            "urgency": 7, "importance": 8, "severity": 7, 
            "deadline": f_date(now + timedelta(days=2)), 
            "status": "completed", "completed_at": now - timedelta(days=1), 
            "duration_minutes": 45
        })
        tasks.append({
            "title": "Earlier Task B", 
            "urgency": 5, "importance": 5, "severity": 5, 
            "deadline": f_date(now), 
            "status": "completed", "completed_at": now - timedelta(hours=1), 
            "duration_minutes": 60
        })

        for t_data in tasks:
            comp_at = t_data.pop('completed_at', None)
            task = Task(user_id=user.id, **t_data)
            task.completed_at = comp_at
            db.session.add(task)
        
        db.session.commit()
        print(f"Successfully seeded {len(tasks)} extreme performance tasks.")

if __name__ == "__main__":
    seed_extreme_data()
