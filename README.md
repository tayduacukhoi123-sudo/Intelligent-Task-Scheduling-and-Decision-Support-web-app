# Task Priority Manager — Intelligent Task Scheduling & Decision Support

A web-based time management application that accepts unstructured task input and processes it through a two-pass algorithm combining **Weighted Scoring** and **Eisenhower Matrix** classification to produce an optimally ordered task list. Built as the final project for **Chuyên đề 2 (SS2)** at Hanoi University.

> **Live Demo:** [https://task-priority-manager.onrender.com](https://task-priority-manager.onrender.com)

---

## Team

**Course:** Chuyên đề 2 (SS2) — Hanoi University / Faculty of Information Technology
**Group:** Group 2

| Name | Student ID | Role | Responsibilities |
|------|-----------|------|-----------------|
| Hoàng Trung Đức | 2301040046 | BA / PM | Requirements gathering, ERD design, API specification, project tracking, final report |
| Nguyễn Minh Quang | — | Backend Dev | Flask project setup, database connection, models, CRUD APIs, CORS configuration, authentication |
| Chu Minh Hiếu | 2201040065 | Algorithm Dev | Algorithm implementation, web appearance design, performance metrics, AI API integration |

---

## Tech Stack

| Layer | Technology |
|------:|:-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Python 3.10+, Flask |
| ORM | SQLAlchemy (Flask-SQLAlchemy) |
| Database | SQLite (local dev) / PostgreSQL (Neon, production) |
| Migrations | Flask-Migrate (Alembic) |
| Auth | Google OAuth 2.0 (Sign-In with Google) |
| AI | External AI API (Google Gemini) — natural-language task parsing & scoring suggestions |
| Email | Flask-Mail + APScheduler (daily reminders) |
| Deployment | Render (Gunicorn) |
| Architecture | 3-tier: GUI (HTML/CSS/JS) → BLL (Flask routes + algorithm.py) → DAL (SQLAlchemy ORM + DB) |

---

## Main Features

- **Login / Logout** — Google OAuth 2.0 sign-in; user profile created automatically on first login.
- **Task CRUD** — Create, read, update, delete tasks with urgency / importance / severity / deadline.
- **Weighted Scoring + Eisenhower Matrix Sorting** — Two-pass algorithm: weighted scoring first, then Eisenhower quadrant classification (Do First, Schedule, Delegate, Eliminate).
- **Schedule Dashboard** — Visual task board sorted by priority with real-time score recalculation.
- **History Tracking** — Completed tasks log with timestamps; clearable history.
- **Deadline Management + Re-sort** — Scores automatically increase as deadlines approach; task order updates in real time.
- **Progress Tracking** — Track task completion status across active and completed states.
- **Calendar View** — Visual calendar interface for deadline overview.
- **AI-Powered Task Suggestions** — Describe a task in natural language; AI extracts title, deadline, urgency/importance scores, tags, and detects schedule conflicts.
- **Notification / Reminder System** — APScheduler cron job sends priority-sorted HTML email daily.
- **Export (XLSX)** — Export task data to Excel spreadsheet.
- **Performance Metrics** — Three-metric evaluation framework: Completion, Agility, and Flexibility scores over a 3-day rolling window.
- **Smart Tags** — Auto-generated contextual tags with color coding.

---

## Project Structure

```
Intelligent-Task-Scheduling-and-Decision-Support-web-app/
├── README.md                  # This file
├── render.yaml                # Render deployment config
│
└── src/                       # ← All source code lives here
    ├── .env.example           # Environment variable template
    ├── .gitignore             # Git ignore rules
    ├── requirements.txt       # Python dependencies
    ├── Procfile               # Gunicorn entry point (production)
    ├── start.sh               # Startup script (migration + serve)
    │
    ├── app.py                 # Flask app factory (create_app)
    ├── extensions.py          # SQLAlchemy, Migrate, Mail instances
    ├── models.py              # Database models (User, Task, Schedule)
    ├── routes.py              # All API & page routes (Blueprint)
    ├── algorithm.py           # Priority scoring engine + Eisenhower
    ├── scheduler.py           # APScheduler daily notification job
    ├── mail_service.py        # HTML/plain-text email builder + sender
    ├── seed_data.py           # Sample data seeder for testing
    ├── schema.sql             # SQL database schema (SQLite/PostgreSQL compatible)
    ├── fix_db_schema.py       # One-time DB migration fix script
    ├── update_schema.py       # Add completed_at column script
    ├── diagram                # ERD diagram (draw.io XML)
    ├── workflow_interworking.txt  # Architecture documentation
    │
    ├── migrations/            # Flask-Migrate (Alembic) migrations
    │   ├── alembic.ini
    │   ├── env.py
    │   ├── script.py.mako
    │   └── versions/          # Migration version files
    │
    ├── static/                # Frontend assets
    │   ├── script.js          # Main JavaScript (API calls, UI logic)
    │   └── styles.css         # All CSS styles
    │
    └── templates/             # Jinja2 HTML templates
        ├── login.html         # Login page (Google OAuth)
        ├── index.html         # Dashboard (main page)
        ├── task.html          # Task management page
        ├── schedule.html      # Eisenhower Matrix schedule view
        └── history.html       # Completed task history
```

---

## Installation & Setup

### Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **pip** — comes with Python
- **Git** — [Download](https://git-scm.com/downloads)
- A **Google Cloud** project with OAuth 2.0 credentials ([Guide](https://console.cloud.google.com/apis/credentials))
- *(Optional)* A **Google Gemini API** key for AI features ([Get one](https://aistudio.google.com/app/apikey))
- *(Optional)* A **Gmail App Password** for email notifications ([Guide](https://support.google.com/accounts/answer/185833))

### Step 1 — Clone the Repository

```bash
git clone https://github.com/tayduacukhoi123-sudo/Intelligent-Task-Scheduling-and-Decision-Support-web-app.git
cd Intelligent-Task-Scheduling-and-Decision-Support-web-app
```

### Step 2 — Create a Virtual Environment

```bash
# Windows
cd src
python -m venv venv
venv\Scripts\activate

# macOS / Linux
cd src
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Configure Environment Variables

```bash
# Copy the example file
cp .env.example .flaskenv       # Linux/macOS
copy .env.example .flaskenv     # Windows
```

Edit `.flaskenv` and fill in your real values:

```env
# Required
FLASK_APP=app:create_app
FLASK_DEBUG=1
DATABASE_URL=sqlite:///database.db
SECRET_KEY=<generate-a-random-string>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Optional — AI task parsing
GEMINI_API_KEY=<your-gemini-api-key>

# Optional — Email notifications
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=<your-gmail>
MAIL_PASSWORD=<your-gmail-app-password>
MAIL_DEFAULT_SENDER=<your-gmail>
```

> **Note:** For Google OAuth, you must add `http://localhost:5000` to **Authorized JavaScript origins** in your Google Cloud Console.

### Step 5 — Initialize the Database

The database is automatically created on first run via `db.create_all()`. To run Alembic migrations:

```bash
flask db upgrade
```

### Step 6 — (Optional) Seed Sample Data

```bash
python seed_data.py
```

This creates 8 sample tasks for the first user in the database. You must log in with Google first to have a user in the DB.

---

## How to Run

### Run the Backend (Flask Server)

```bash
cd src
flask run
```

The server starts at: **http://localhost:5000**

### Run the Frontend

The frontend is served **by Flask itself** — no separate frontend server is needed. Simply open:

```
http://localhost:5000
```

You will see the login page. Sign in with Google to access the dashboard.

### Run the Full System from a Clean Machine

```bash
# 1. Clone
git clone https://github.com/tayduacukhoi123-sudo/Intelligent-Task-Scheduling-and-Decision-Support-web-app.git
cd Intelligent-Task-Scheduling-and-Decision-Support-web-app/src

# 2. Virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
copy .env.example .flaskenv    # Windows
# cp .env.example .flaskenv    # macOS/Linux
# → Edit .flaskenv with your real keys

# 5. Initialize DB + run
flask db upgrade
flask run

# 6. Open http://localhost:5000 in your browser
```

---

## Demo Account

This app uses **Google OAuth 2.0** for authentication.

To test the app:
1. Go to `http://localhost:5000`
2. Click **"Sign in with Google"**
3. Use any Google account to log in — a user profile is created automatically on first sign-in

> **Note:** For the grading team — if the Google OAuth Client ID has been restricted to specific test accounts, please contact the team for access or use the deployed version at the live demo URL above.
>
> If a specific demo account has been set up, credentials will be provided in the submission email.

---

## Database Migration

The project uses **Flask-Migrate** (Alembic) for database schema management.

```bash
# Apply all pending migrations
flask db upgrade

# Create a new migration after model changes
flask db migrate -m "description of change"

# Downgrade one step
flask db downgrade
```

For fresh setups, `db.create_all()` in `app.py` auto-creates all tables if they don't exist.

---

## Known Issues & Limitations

1. **Pomodoro timer not implemented** — Was planned but not completed within the course timeline. Users must use external timer tools.

2. **Performance metrics formulas need real-world validation** — Agility and Flexibility scores are theoretically defined but not yet tested with diverse user behavior data.

3. **No mobile-responsive design** — The application may not render well on small screens. Future work: apply responsive CSS or migrate to a framework with mobile support.

4. **Deployment in progress** — Application is fully functional on localhost; cloud deployment (Render) is being finalized.

5. **No unit tests** — The `algorithm.py` scoring functions are pure and easily testable, but automated tests have not been implemented yet.

6. **`routes.py` is monolithic (~650 lines)** — All API routes are in a single file. Should be split into Flask Blueprints by feature area.

7. **Frontend priority score may slightly differ from backend** — Both `script.js` and `algorithm.py` implement the same formula, but edge cases in date parsing may cause minor differences.

8. **Email feature requires Gmail App Password** — Standard Gmail passwords don't work; you need to generate an [App Password](https://support.google.com/accounts/answer/185833) with 2-Step Verification enabled.

9. **Single user only** — No team/shared task features. Future improvement: add workspace and task assignment for collaborative use.

---

## Algorithm

Tasks are scored using a weighted formula with a deadline-proximity multiplier:

$$
\text{Score} = (W_U \times \text{Urgency} + W_I \times \text{Importance} + W_S \times \text{Severity}) \times \left(1 + \frac{\alpha}{\text{DaysRemaining} + 1}\right)
$$

| Constant | Value | Meaning |
|----------|-------|---------|
| W_U | 0.3 | Urgency weight |
| W_I | 0.4 | Importance weight |
| W_S | 0.3 | Severity weight |
| α | 2 | Deadline decay factor |

The score is normalized to a **1.0–10.0** scale for display. As a deadline approaches, the multiplier increases, automatically pushing urgent tasks to the top.

### Eisenhower Matrix Classification

| Quadrant | Condition | Action |
|----------|-----------|--------|
| 🔴 Do First | Urgency ≥ 6 AND Importance ≥ 6 | Do immediately |
| 🔵 Schedule | Urgency < 6 AND Importance ≥ 6 | Plan for later |
| 🟡 Delegate | Urgency ≥ 6 AND Importance < 6 | Delegate to others |
| ⚪ Eliminate | Urgency < 6 AND Importance < 6 | Consider dropping |

---

## License

This project was developed for academic purposes as part of the **Chuyên đề 2** course at **Hanoi University (HANU)**.