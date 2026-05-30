from app import create_app
from models import db, User, Task
from datetime import datetime, timedelta

def seed():
    app = create_app()
    with app.app_context():
        # Get the primary user
        user = User.query.filter_by(email='tayduacukhoi123@gmail.com').first()
        if not user:
            # Fallback to the first user if email doesn't match
            user = User.query.first()
        
        if not user:
            print("No users found in database. Please log in first!")
            return

        print("Creating seed tasks for the active user...")

        # Set relative dates
        today = datetime.now()
        f_date = lambda d: d.strftime('%Y-%m-%d')

        seed_tasks = [
            { "title": "Submit Final Project Report", "urgency": 10, "importance": 10, "severity": 9, "deadline": f_date(today + timedelta(days=1)) },
            { "title": "Prepare for Team Sprint Presentation", "urgency": 8, "importance": 9, "severity": 7, "deadline": f_date(today + timedelta(days=2)) },
            { "title": "Review PR for Authentication Fix", "urgency": 9, "importance": 7, "severity": 6, "deadline": f_date(today) },
            { "title": "Update Project README and Docs", "urgency": 4, "importance": 6, "severity": 3, "deadline": f_date(today + timedelta(days=5)) },
            { "title": "Weekly Grocery Shopping", "urgency": 5, "importance": 4, "severity": 2, "deadline": f_date(today + timedelta(days=3)) },
            { "title": "Quarterly Performance Review", "urgency": 6, "importance": 9, "severity": 8, "deadline": f_date(today + timedelta(days=14)) },
            { "title": "Fix UI Alignment in Login Page", "urgency": 7, "importance": 5, "severity": 4, "deadline": f_date(today - timedelta(days=1)) }, # Overdue
            { "title": "Initialize Repository for New Project", "urgency": 10, "importance": 8, "severity": 5, "deadline": f_date(today - timedelta(days=5)), "status": "completed" }
        ]

        # Clearing existing tasks for a fresh start (optional, but good for seeding)
        Task.query.filter_by(user_id=user.id).delete()

        for t in seed_tasks:
            status = t.pop('status', 'active')
            task = Task(user_id=user.id, status=status, **t)
            db.session.add(task)
        
        db.session.commit()
        print("Successfully seeded 8 tasks!")

if __name__ == "__main__":
    seed()
