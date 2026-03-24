# Task Priority Manager

This web application streamlines productivity by merging the Eisenhower Matrix with a multi-criteria weighted scoring system.

## Overview

The application executes a defined pipeline where user-submitted tasks are first evaluated on a scale of urgency, importance, severity, and deadline. The system processes these inputs to categorize and rank tasks optimally, delivering a structured list that is simultaneously recorded as part of the user's permanent schedule history.

## Tech Stack

|  Layer   |    Technology    |
| -------: | :--------------- |
|  Backend | Python, Flask    |
|      ORM | SQLAlchemy       |
| Database | MySQL            |
| Frontend | HTML / CSS / JS  |
|     Auth | Google OAuth 2.0 |

## Project Structure

```
├── app.py
├── models.py
├── schema.sql
├── requirements.txt
├── routes/
│   ├── auth.py
│   ├── tasks.py
│   ├── sort.py
│   ├── schedule.py
│   └── history.py
├── algorithm/
│   └── scoring.py
├── docs/
│   ├── api_spec.md
│   ├── uc_diagram.xml
│   ├── sequence_diagram.xml
│   └── erd_diagram.xml
└── frontend/
    ├── index.html
    ├── tasks.html
    ├── schedule.html
    └── history.html
```

## Setup & Installation

1. Clone the repo

```bash
git clone <repo-url>
cd task-priority-manager
```

2. Install dependencies

```bash
pip install -r requirements.txt
```

3. Configure environment

Create a `.env` file:

```
FLASK_APP=app.py
FLASK_ENV=development
DATABASE_URL=mysql://user:password@localhost/taskdb
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SECRET_KEY=your_secret_key
```

4. Initialize database

```bash
mysql -u root -p < schema.sql
```

5. Run the app

```bash
flask run
```

## Algorithm

Tasks are evaluated using a weighted equation where urgency and importance each contribute 40% to the final score, while estimated time accounts for the remaining 20%.

$$
\text{score}=(\text{urgency}\times0.4)+(\text{importance}\times0.4)+(\text{estimated time}\times0.2)
$$

Following this calculation, a classification rule sorts tasks into the Eisenhower Matrix quadrants:

|  Quadrant |           Condition            |     Action     |
| --------- | ------------------------------ | -------------- |
| Do First  | High urgency + High importance | Do immediately |
| Schedule  | Low urgency + High importance  | Planning       |
| Delegate  | High urgency + Low importance  | Delegate       |
| Eliminate | Low urgency + Low importance   | Drop           |

The ultimate output is a sorted list where tasks inside each category are ranked from highest to lowest score.

## Team
|        Name       |      Role     |                Responsibilities                |
| ----------------- | ------------- | ---------------------------------------------- |
| Hoàng Trung Đức   | BA / PM       | Requirements, diagrams, documentation          |
| Nguyễn Minh Quang | Backend Dev   | Flask, API, database, ORM, authentication      |
| Chu Minh Hiếu     | Algorithm Dev | algorithm, history tracking, database, testing |

## Course

Chuyên đề 2 — [HANU / Công nghệ thông tin]