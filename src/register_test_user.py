from app import create_app
from models import db, User

def register_manual_user(email, name):
    app = create_app()
    with app.app_context():
        # Check if user exists
        user = User.query.filter_by(email=email).first()
        if user:
            print(f"User {email} already exists with ID: {user.id}")
            return
            
        new_user = User(email=email, name=name)
        db.session.add(new_user)
        db.session.commit()
        print(f"Successfully registered {name} ({email}) with ID: {new_user.id}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python register_test_user.py <email> <name>")
    else:
        register_manual_user(sys.argv[1], sys.argv[2])
