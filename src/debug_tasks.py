import os
from app import create_app
from models import User, Task

os.environ["DATABASE_URL"] = "postgresql://neondb_owner:npg_3MIokjFZY0Op@ep-dry-bird-amivmtzu-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
app = create_app()
with app.app_context():
    users = User.query.all()
    print(f"Total Users: {len(users)}")
    for u in users:
        print(f"User: {u.email} | ID: {u.id}")
        
    user = User.query.filter_by(email="tayduacukhoi123@gmail.com").first()
    if not user:
        print("User not found.")
    else:
        tasks = Task.query.filter_by(user_id=user.id).all()
        for t in tasks:
            print(f"Title: {t.title} | Deadline: {t.deadline} | Status: {t.status} | CompletedAt: {t.completed_at}")
