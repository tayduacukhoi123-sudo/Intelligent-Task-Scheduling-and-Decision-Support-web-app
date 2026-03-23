# Task Priority Manager
A web application that automatically sorts and prioritizes tasks using Eisenhower matrix combined with multi-criteria weighted scoring algorithm.

## Overview
Users input their tasks (big,small,inneed,crucial) and the system processes them through a scoring pipeline, categorizes them and produce an optimally ordered task list , then saves the result as a schedule history to make plans for users .
**Core flow:**
User inputs tasks → multi-criteria scoring (urgency, importance, severity, deadline) the task bases on criterias evaluated on scale by user  -> distributes them into categories → sorted task list → save to history

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| ORM | SQLAlchemy |
| Database | MySQL |
| Frontend | HTML / CSS / JS |
| Auth | Google OAuth 2.0 |

## Project Structure
/
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
Create `.env` file:
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
App runs at `http://localhost:5000`

---
## Algorithm
Tasks are scored using a weighted formula:
```
score = (urgency × 0.4) + (importance × 0.4) + (estimated_time × 0.2)
```
Each task is then classified into one of four Eisenhower quadrants:
| Quadrant | Condition | Action |
|---|---|---|
| Do First | High urgency + High importance | Do immediately |
| Schedule | Low urgency + High importance | Planning |
| Delegate | High urgency + Low importance | Delegate |
| Eliminate | Low urgency + Low importance | Drop |
Final sorted list is ordered by score (descending) within each quadrant.

---
## Team
| Name | Role | Responsibilities |
|---|---|---|
|Hoàng Trung Đức| BA / PM | Requirements, diagrams, documentation |
|Nguyễn Minh Quang| Backend Dev | Flask, API, database, ORM, authentication |
|Chu Minh Hiếu  | Algorithm Dev | algorithm, history tracking, database, testing |

---

## Course
Chuyên đề 2 — [HANU / Công nghệ thông tin]
