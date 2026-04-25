from app import create_app
from models import User
app = create_app()
with app.app_context():
    for u in User.query.all():
        print(u.email)
