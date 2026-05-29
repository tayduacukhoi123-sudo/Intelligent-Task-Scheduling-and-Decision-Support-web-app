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

## Installation & Clean-Machine Setup Guide

This guide walks you through setting up and running the **Task Priority Manager** on a clean machine from scratch.

### 1. Install Required Tools
Ensure you have the following installed on your machine:
*   **Python 3.10+**: [Download Python](https://www.python.org/downloads/) (Make sure to check "Add Python to PATH" during installation)
*   **Git**: [Download Git](https://git-scm.com/downloads)

### 2. Copy .env.example to .env and Fill Values
Clone this repository and go to the project directory:
```bash
git clone https://github.com/tayduacukhoi123-sudo/Intelligent-Task-Scheduling-and-Decision-Support-web-app.git
cd Intelligent-Task-Scheduling-and-Decision-Support-web-app
```

Copy the template environment configuration file to `.env`:
*   **Windows (PowerShell/CMD):**
    ```powershell
    copy .env.example .env
    ```
*   **macOS / Linux:**
    ```bash
    cp .env.example .env
    ```

Open the newly created `.env` file and fill in the values:
```env
FLASK_APP=src/app.py
FLASK_DEBUG=1
DATABASE_URL=sqlite:///database.db
SECRET_KEY=generate-a-random-string-here

# Google OAuth 2.0 Credentials (Required for login)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Google Gemini API Key (Required for AI task suggestions)
GEMINI_API_KEY=your-gemini-api-key

# Email Notification Server (Optional)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-email@gmail.com
```

### 3. Install Backend Dependencies and Run Database Migration/Seed
Create a virtual environment, activate it, install dependencies, and run migrations:

*   **Windows:**
    ```powershell
    # Create virtual environment
    python -m venv venv
    
    # Activate virtual environment
    .\venv\Scripts\Activate.ps1
    
    # Install dependencies
    pip install -r src/requirements.txt
    
    # Run database migration (create schema)
    flask db upgrade
    
    # (Optional) Seed database with mock tasks
    python src/seed_data.py
    ```
*   **macOS / Linux:**
    ```bash
    # Create virtual environment
    python3 -m venv venv
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -r src/requirements.txt
    
    # Run database migration (create schema)
    flask db upgrade
    
    # (Optional) Seed database with mock tasks
    python3 src/seed_data.py
    ```

### 4. Start Backend Server
Start the Flask backend application:
```bash
flask run
```
The server will boot up and be accessible locally at: **`http://localhost:5000`**

### 5. Install Frontend Dependencies and Start Frontend
This application uses a 3-tier architecture with a frontend built on standard **HTML5, CSS3, and Vanilla JavaScript**. 
*   **No separate frontend dependencies** (Node.js/npm) are required.
*   **No separate frontend server** is needed; the frontend files are served directly by the Flask backend application.
*   Starting the backend server in Step 4 automatically hosts and starts the frontend.

### 6. Open the Application and Login with Demo Account
1. Open your web browser and navigate to: **`http://localhost:5000`**
2. Click the **"Sign in with Google"** button.
3. Log in using any valid Google Account. Since Google OAuth 2.0 is integrated, a new user profile will be automatically provisioned in the database upon your first successful login.

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