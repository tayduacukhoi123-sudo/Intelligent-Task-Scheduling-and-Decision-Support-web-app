"""
Mock data generation script for Function 2 (Performance Metrics).
Generates tasks over the last 3 days with varied completion statuses to test 
Completion, Agility, and Flexibility scores.
"""
import os
import json
from datetime import datetime, timedelta
from app import create_app
from models import db, User, Task

def seed_mock_data():
    app = create_app()
    with app.app_context():
        # 1. Identify Test User
        user = User.query.first()
        if not user:
            print("No users found. Please log in to the app first.")
            return
        
        print(f"Seeding mock performance data for user: {user.email}")
        
        # 2. Clear previous tasks to have a clean 3-day window
        Task.query.filter_by(user_id=user.id).delete()
        
        now = datetime.utcnow()
        today = now.replace(hour=12, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        day_before = today - timedelta(days=2)
        tomorrow = today + timedelta(days=1)

        def f_date(dt): return dt.strftime('%Y-%m-%d %H:%M:%S')

        # 3. Create Mock Tasks
        mock_tasks = [
            # --- DAY BEFORE YESTERDAY ---
            # Task 1: Completed on time
            {
                "title": "Task A (Day-2): On Time",
                "urgency": 8, "importance": 8, "severity": 8, # Weighted Score: 80
                "deadline": f_date(day_before + timedelta(hours=4)),
                "status": "completed",
                "completed_at": day_before + timedelta(hours=2),
                "duration_minutes": 60
            },
            # Task 2: Severe Delay Penalty (Late >= 2 days)
            # Actually, to be late 2 days in a 3-day window, it must have been due long ago.
            # Let's say it was due 3 days ago, completed yesterday.
            {
                "title": "Task B (Penalty): Severe Late",
                "urgency": 9, "importance": 9, "severity": 9, # Weighted Score: 90
                "deadline": f_date(now - timedelta(days=4)),
                "status": "completed",
                "completed_at": yesterday,
                "duration_minutes": 120
            },
            
            # --- YESTERDAY ---
            # Task 3: Early Bonus (completed 1 day early)
            {
                "title": "Task C (Bonus): Early Bird",
                "urgency": 7, "importance": 6, "severity": 5, # Weighted Score: 61
                "deadline": f_date(today),
                "status": "completed",
                "completed_at": yesterday,
                "duration_minutes": 45
            },
            # Task 4: Smart Interleave (Task D due tomorrow, Task E due today)
            # We complete D then E.
            {
                "title": "Task D (Smart): Interleaved",
                "urgency": 8, "importance": 7, "severity": 6, # Weighted Score: 71 (Smart >= 70)
                "deadline": f_date(tomorrow),
                "status": "completed",
                "completed_at": yesterday + timedelta(hours=2),
                "duration_minutes": 30
            },
            {
                "title": "Task E: Standard",
                "urgency": 5, "importance": 5, "severity": 5, # Weighted Score: 50
                "deadline": f_date(yesterday + timedelta(hours=5)),
                "status": "completed",
                "completed_at": yesterday + timedelta(hours=4),
                "duration_minutes": 90
            },
            
            # --- TODAY ---
            # Task 6: Completed Today
            {
                "title": "Task F: Done Today",
                "urgency": 6, "importance": 8, "severity": 7, # Weighted Score: 71
                "deadline": f_date(today + timedelta(hours=2)),
                "status": "completed",
                "completed_at": now - timedelta(minutes=30),
                "duration_minutes": 120
            },
            # Task 7: Active (Incomplete)
            {
                "title": "Task G: Pending Today",
                "urgency": 10, "importance": 10, "severity": 10, # Weighted Score: 100
                "deadline": f_date(today + timedelta(hours=5)),
                "status": "active",
                "duration_minutes": 180
            }
        ]

        for t_data in mock_tasks:
            comp_at = t_data.pop('completed_at', None)
            task = Task(user_id=user.id, **t_data)
            task.completed_at = comp_at
            db.session.add(task)
        
        db.session.commit()
        print(f"Successfully seeded {len(mock_tasks)} mock tasks for performance testing.")
        print("Metrics Expectation:")
        print("- Completion: Partial (Task G is active)")
        print("- Agility: Partial (Task G is active)")
        print("- Flexibility: Should have Early Bonus and Smart Interleave Bonus, but also a Delay Penalty.")

if __name__ == "__main__":
    seed_mock_data()
