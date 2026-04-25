"""
Comprehensive Mock Data for Performance & Calendar Testing.
- Last 3 Days: Completed tasks with varied scores (Bonus/Penalty).
- Next 3 Days: Active tasks to test calendar dots and priority.
"""
import os
from datetime import datetime, timedelta
from app import create_app
from models import db, User, Task

def seed_comprehensive_data():
    app = create_app()
    with app.app_context():
        user = User.query.filter_by(email='tayduacukhoi123@gmail.com').first()
        if not user:
            print("User not found.")
            return
        
        print(f"Seeding comprehensive test data for: {user.email}")
        Task.query.filter_by(user_id=user.id).delete()
        
        now = datetime.utcnow()
        def f_date(dt): return dt.strftime('%Y-%m-%d %H:%M:%S')

        tasks = []
        
        # --- PAST 3 DAYS (Completed) ---
        # 2 Days Ago (3 tasks)
        d2 = now - timedelta(days=2)
        tasks.append({"title": "Finished Report (Early)", "urgency": 8, "importance": 9, "severity": 7, "deadline": f_date(d2 + timedelta(days=1)), "status": "completed", "completed_at": d2, "duration_minutes": 60})
        tasks.append({"title": "Team Sync (On Time)", "urgency": 5, "importance": 5, "severity": 5, "deadline": f_date(d2 + timedelta(hours=2)), "status": "completed", "completed_at": d2, "duration_minutes": 30})
        tasks.append({"title": "Budget Review (Late)", "urgency": 9, "importance": 10, "severity": 8, "deadline": f_date(d2 - timedelta(days=2)), "status": "completed", "completed_at": d2, "duration_minutes": 120})

        # Yesterday (3 tasks)
        yest = now - timedelta(days=1)
        # Smart Interleave Pair: Task A (due tomorrow) done before Task B (due yesterday)
        tasks.append({"title": "Smart Task A (Interleave)", "urgency": 8, "importance": 8, "severity": 8, "deadline": f_date(now + timedelta(days=1)), "status": "completed", "completed_at": yest - timedelta(hours=2), "duration_minutes": 45})
        tasks.append({"title": "Basic Task B", "urgency": 4, "importance": 4, "severity": 4, "deadline": f_date(yest), "status": "completed", "completed_at": yest, "duration_minutes": 60})
        tasks.append({"title": "Email Catchup", "urgency": 3, "importance": 6, "severity": 4, "deadline": f_date(yest + timedelta(hours=5)), "status": "completed", "completed_at": yest + timedelta(hours=1), "duration_minutes": 90})

        # Today (2 completed)
        tasks.append({"title": "UI Bug Fix (Today Win)", "urgency": 10, "importance": 7, "severity": 9, "deadline": f_date(now), "status": "completed", "completed_at": now - timedelta(hours=2), "duration_minutes": 30})
        tasks.append({"title": "Documentation", "urgency": 4, "importance": 8, "severity": 5, "deadline": f_date(now + timedelta(hours=4)), "status": "completed", "completed_at": now - timedelta(minutes=15), "duration_minutes": 60})

        # --- NEXT 3 DAYS (Active) ---
        # Tomorrow (2 tasks)
        tomorrow = now + timedelta(days=1)
        tasks.append({"title": "Project Pitch (Q1)", "urgency": 10, "importance": 10, "severity": 9, "deadline": f_date(tomorrow + timedelta(hours=2)), "status": "active", "duration_minutes": 60})
        tasks.append({"title": "Grocery Run (Q3)", "urgency": 7, "importance": 3, "severity": 2, "deadline": f_date(tomorrow + timedelta(hours=8)), "status": "active", "duration_minutes": 45})

        # Day After Tomorrow (2 tasks)
        dat = now + timedelta(days=2)
        tasks.append({"title": "Deep Work (Q2)", "urgency": 4, "importance": 9, "severity": 6, "deadline": f_date(dat + timedelta(hours=3)), "status": "active", "duration_minutes": 180})
        tasks.append({"title": "Leisure Read (Q4)", "urgency": 2, "importance": 2, "severity": 1, "deadline": f_date(dat + timedelta(hours=6)), "status": "active", "duration_minutes": 120})

        # 3 Days From Now (1 task)
        d3 = now + timedelta(days=3)
        tasks.append({"title": "Upcoming Meeting", "urgency": 6, "importance": 6, "severity": 6, "deadline": f_date(d3), "status": "active", "duration_minutes": 60})

        for t_data in tasks:
            comp_at = t_data.pop('completed_at', None)
            task = Task(user_id=user.id, **t_data)
            task.completed_at = comp_at
            db.session.add(task)
        
        db.session.commit()
        print(f"Successfully seeded {len(tasks)} tasks spanning 6 days.")

if __name__ == "__main__":
    seed_comprehensive_data()
