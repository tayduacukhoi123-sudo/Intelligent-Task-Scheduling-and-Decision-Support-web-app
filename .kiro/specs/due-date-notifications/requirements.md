# Requirements Document

## Introduction

This document defines the requirements for the **Due Date Notifications** feature of the Intelligent Task Scheduling and Decision Support web application. The feature adds automated daily email reminders and an in-app notification modal for tasks whose deadline falls on the current day. A background scheduler fires at 08:00 AM each day, identifies tasks due today that have not yet been notified, sends a priority-sorted email to each affected user, and marks those tasks as notified. A REST endpoint allows the frontend to poll for today's due tasks on page load and display a modal. The feature also consolidates the priority-score formula into a shared Python module so both the scheduler and the frontend API use the same calculation logic.

---

## Glossary

- **Task**: A unit of work stored in the database with fields including title, urgency, importance, severity, deadline, status, and tags.
- **User**: An authenticated account identified by a unique integer ID and associated email address.
- **Priority_Score_Engine**: The `algorithm.py` module that implements `calculate_priority_score()` and `get_eisenhower_quadrant()`.
- **Scheduler**: The `scheduler.py` module that registers and runs the APScheduler background job (`daily_notification_job()`).
- **Mail_Service**: The `mail_service.py` module that constructs and sends HTML notification emails via Flask-Mail.
- **Notifications_API**: The `GET /api/notifications` endpoint in `routes.py`.
- **Notification_UI**: The `checkDueNotifications()` and `showDueModal()` functions in `script.js`.
- **is_notified**: A boolean column on the `Task` model that records whether a notification email has been sent for that task on its due date.
- **Eisenhower_Quadrant**: One of four classifications (`Q1_DO_FIRST`, `Q2_SCHEDULE`, `Q3_DELEGATE`, `Q4_ELIMINATE`) derived from urgency and importance scores.
- **Normalized_Score**: The raw priority score scaled to the range [1.0, 10.0].
- **days_remaining**: The number of days (ceiling) between the current datetime and the task deadline; clamped to 0 for past deadlines.
- **SMTP**: Simple Mail Transfer Protocol used to deliver notification emails.

---

## Requirements

### Requirement 1: Task Model Extension

**User Story:** As a developer, I want the Task model to track whether a notification has been sent, so that the system can avoid sending duplicate emails for the same task on the same day.

#### Acceptance Criteria

1. THE Task model SHALL include an `is_notified` boolean column with a non-null constraint and a default value of `False`.
2. WHEN a new Task is created, THE Task model SHALL set `is_notified` to `False` regardless of any other field values provided.
3. WHEN the database migration is applied to an existing database, THE migration SHALL add the `is_notified` column to all existing Task rows with a default value of `False`.
4. THE `is_notified` field SHALL be read-only from the client perspective; THE Notifications_API SHALL NOT accept `is_notified` as a writable field in any request body.

---

### Requirement 2: Priority Score Calculation

**User Story:** As a developer, I want a single authoritative Python function for calculating task priority scores, so that the scheduler email and the notifications API both produce consistent, formula-correct scores.

#### Acceptance Criteria

1. WHEN `calculate_priority_score(urgency, importance, severity, deadline_str)` is called with valid inputs, THE Priority_Score_Engine SHALL return a dictionary containing the keys `score` (float ≥ 0), `days_remaining` (integer), `total_hours` (float), and `normalized` (float).
2. WHEN `calculate_priority_score` is called with valid inputs, THE Priority_Score_Engine SHALL compute `score` using the formula: `(0.3 × urgency + 0.4 × importance + 0.3 × severity) × (1 + 2 / (max(0, days_remaining) + 1))`.
3. WHEN `calculate_priority_score` is called with any valid inputs, THE Priority_Score_Engine SHALL return a `normalized` value that satisfies `1.0 ≤ normalized ≤ 10.0`.
4. WHEN `calculate_priority_score` is called with a fixed urgency, importance, and severity and two deadlines where deadline_A is closer to the current time than deadline_B, THE Priority_Score_Engine SHALL return a `score` for deadline_A that is greater than or equal to the `score` for deadline_B.
5. WHEN `calculate_priority_score` is called with a deadline that is in the past, THE Priority_Score_Engine SHALL clamp `days_remaining` to 0 and return the maximum score achievable for the given urgency, importance, and severity values.
6. IF `deadline_str` cannot be parsed as a valid `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` date string, THEN THE Priority_Score_Engine SHALL return `{"score": 0, "days_remaining": 0, "total_hours": 0, "normalized": 1.0}` without raising an exception.

---

### Requirement 3: Eisenhower Quadrant Classification

**User Story:** As a developer, I want a Python function that classifies tasks into Eisenhower quadrants using the same thresholds as the frontend, so that quadrant labels are consistent across email notifications and the UI.

#### Acceptance Criteria

1. WHEN `get_eisenhower_quadrant(urgency, importance)` is called with any urgency and importance values in the range [1, 10], THE Priority_Score_Engine SHALL return exactly one of the strings: `"Q1_DO_FIRST"`, `"Q2_SCHEDULE"`, `"Q3_DELEGATE"`, or `"Q4_ELIMINATE"`.
2. WHEN `get_eisenhower_quadrant` is called with `urgency >= 6` and `importance >= 6`, THE Priority_Score_Engine SHALL return `"Q1_DO_FIRST"`.
3. WHEN `get_eisenhower_quadrant` is called with `urgency < 6` and `importance >= 6`, THE Priority_Score_Engine SHALL return `"Q2_SCHEDULE"`.
4. WHEN `get_eisenhower_quadrant` is called with `urgency >= 6` and `importance < 6`, THE Priority_Score_Engine SHALL return `"Q3_DELEGATE"`.
5. WHEN `get_eisenhower_quadrant` is called with `urgency < 6` and `importance < 6`, THE Priority_Score_Engine SHALL return `"Q4_ELIMINATE"`.
6. WHEN `get_eisenhower_quadrant` is called with the same urgency and importance values on multiple invocations, THE Priority_Score_Engine SHALL return the same quadrant string on every invocation.

---

### Requirement 4: Daily Notification Scheduler

**User Story:** As a user, I want to receive an email at 08:00 AM each day listing my tasks that are due today, so that I am reminded to complete them before their deadline.

#### Acceptance Criteria

1. WHEN the Flask application starts, THE Scheduler SHALL register `daily_notification_job` to execute once per day at 08:00 AM local server time.
2. WHEN `daily_notification_job` executes, THE Scheduler SHALL query the database for all Task records where `deadline` matches today's date, `is_notified` is `False`, and `status` is `'active'`.
3. WHEN `daily_notification_job` executes and tasks due today are found, THE Scheduler SHALL group those tasks by `user_id` and send exactly one email per user containing all of that user's due tasks sorted by priority score descending.
4. WHEN `daily_notification_job` successfully sends an email for a user, THE Scheduler SHALL set `is_notified` to `True` for all of that user's tasks included in the email and commit the change to the database.
5. IF `send_notification_email` returns `False` for a user, THEN THE Scheduler SHALL NOT set `is_notified` to `True` for that user's tasks, leaving them eligible for retry on the next scheduled run.
6. WHEN `daily_notification_job` is run a second time on the same day after a successful first run, THE Scheduler SHALL NOT send any duplicate emails because all previously notified tasks have `is_notified` set to `True`.
7. WHEN the application is deployed with multiple Gunicorn worker processes, THE Scheduler SHALL start only one scheduler instance across all worker processes using a process guard mechanism.
8. IF an unhandled exception occurs within `daily_notification_job`, THEN THE Scheduler SHALL catch the exception, log it, and allow the application process to continue running.

---

### Requirement 5: Email Notification Delivery

**User Story:** As a user, I want the notification email to clearly list my due tasks with their priority information, so that I can quickly assess what needs my attention today.

#### Acceptance Criteria

1. WHEN `send_notification_email(recipient_email, recipient_name, tasks)` is called with a valid email address and a non-empty task list, THE Mail_Service SHALL send an email to `recipient_email` and return `True`.
2. WHEN constructing the notification email, THE Mail_Service SHALL include the task title, priority score, Eisenhower quadrant label, and deadline for each task in the email body.
3. WHEN constructing the notification email, THE Mail_Service SHALL provide both an HTML body and a plain-text fallback body in the same message.
4. IF an `smtplib.SMTPException` or any connection error occurs during email sending, THEN THE Mail_Service SHALL catch the exception, log the error without exposing SMTP credentials, and return `False` without re-raising the exception.
5. WHEN `send_notification_email` returns `False`, THE Mail_Service SHALL NOT modify the `tasks` list passed as an argument.

---

### Requirement 6: Notifications REST Endpoint

**User Story:** As a frontend developer, I want a REST endpoint that returns today's due tasks for a given user, so that the dashboard can display an in-app notification modal on page load.

#### Acceptance Criteria

1. WHEN a `GET /api/notifications` request is received without a `user_id` query parameter, THE Notifications_API SHALL return HTTP 400 with the body `{"error": "user_id required"}`.
2. WHEN a `GET /api/notifications` request is received with a `user_id` that does not correspond to any User record, THE Notifications_API SHALL return HTTP 404 with the body `{"error": "User not found"}`.
3. WHEN a `GET /api/notifications` request is received with a valid `user_id`, THE Notifications_API SHALL return HTTP 200 with a JSON array containing all Task records for that user where `deadline` matches today's date and `status` is `'active'`.
4. WHEN constructing the response, THE Notifications_API SHALL include the fields `id`, `title`, `urgency`, `importance`, `severity`, `deadline`, `score`, `normalized_score`, `quadrant`, `tags`, and `is_notified` for each task.
5. WHEN constructing the response, THE Notifications_API SHALL calculate `score`, `normalized_score`, and `quadrant` using the Priority_Score_Engine for each task.
6. THE Notifications_API SHALL never return Task records belonging to a user other than the user identified by the `user_id` query parameter.
7. WHEN a valid `user_id` is provided but no tasks are due today for that user, THE Notifications_API SHALL return HTTP 200 with an empty JSON array `[]`.

---

### Requirement 7: Frontend In-App Notification UI

**User Story:** As a user, I want to see a modal on the dashboard when I have tasks due today, so that I am immediately aware of my deadlines when I open the app.

#### Acceptance Criteria

1. WHEN the dashboard page (`index.html`) finishes loading, THE Notification_UI SHALL call `checkDueNotifications()` to fetch today's due tasks from `GET /api/notifications`.
2. WHEN `checkDueNotifications()` receives a response containing one or more tasks, THE Notification_UI SHALL call `showDueModal(tasks)` to display the due tasks to the user.
3. WHEN `showDueModal(tasks)` is called, THE Notification_UI SHALL render a modal that lists each task with its title, Eisenhower quadrant badge, and normalized score.
4. IF the `GET /api/notifications` fetch request fails or returns a non-200 status, THEN THE Notification_UI SHALL log a warning and return without displaying any modal or crashing the page.
5. THE Notification_UI SHALL only execute `checkDueNotifications()` on the dashboard page and SHALL NOT execute it on other pages such as `task.html`, `schedule.html`, or `history.html`.

---

### Requirement 8: Algorithm Consistency Between Backend and Frontend

**User Story:** As a developer, I want the Python priority score calculation to produce the same results as the existing JavaScript implementation, so that scores displayed in emails match scores shown in the UI.

#### Acceptance Criteria

1. WHEN `calculate_priority_score(urgency, importance, severity, deadline_str)` is called in Python with the same inputs as `calculatePriorityScore(urgency, importance, severity, deadlineStr)` in JavaScript, THE Priority_Score_Engine SHALL return a `score` value equal to the JavaScript result within a floating-point tolerance of 0.01.
2. WHEN `get_eisenhower_quadrant(urgency, importance)` is called in Python with the same inputs as the inline Eisenhower classification logic in `renderSchedule()` in JavaScript, THE Priority_Score_Engine SHALL return the same quadrant string as the JavaScript logic for all valid (urgency, importance) pairs in [1, 10]².

---

### Requirement 9: Configuration and Dependencies

**User Story:** As a developer, I want the application to be configurable via environment variables for SMTP settings, so that email credentials are never committed to source control.

#### Acceptance Criteria

1. THE application SHALL read SMTP configuration from the environment variables `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_DEFAULT_SENDER`.
2. IF any required SMTP environment variable is missing at application startup, THEN THE application SHALL log a clear warning message indicating which variable is absent.
3. THE `requirements.txt` file SHALL include `Flask-Mail==0.10.0` and `Flask-APScheduler==1.13.1` as dependencies.
4. THE application SHALL initialise the Flask-Mail extension and the Scheduler during application startup via `create_app()`.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Normalized score bounds

*For any* valid urgency, importance, and severity values in [1, 10] and any deadline string, `calculate_priority_score()` SHALL return a `normalized` value satisfying `1.0 ≤ normalized ≤ 10.0`.

**Validates: Requirements 2.3**

---

### Property 2: Score monotonicity with deadline proximity

*For any* fixed urgency, importance, and severity values and two future deadlines where deadline_A is strictly closer to the current time than deadline_B, `calculate_priority_score()` SHALL return a `score` for deadline_A that is greater than or equal to the `score` for deadline_B.

**Validates: Requirements 2.4**

---

### Property 3: Eisenhower quadrant completeness

*For any* urgency and importance values in [1, 10]², `get_eisenhower_quadrant()` SHALL return exactly one of the four strings `"Q1_DO_FIRST"`, `"Q2_SCHEDULE"`, `"Q3_DELEGATE"`, or `"Q4_ELIMINATE"`, and the result SHALL be deterministic for any given pair.

**Validates: Requirements 3.1, 3.6**

---

### Property 4: Notification idempotency

*For any* set of tasks due today that have `is_notified = True`, running `daily_notification_job()` SHALL NOT send any emails for those tasks and SHALL NOT modify their `is_notified` value.

**Validates: Requirements 4.6**

---

### Property 5: User isolation in notifications endpoint

*For any* valid `user_id` X, every task returned by `GET /api/notifications?user_id=X` SHALL have a `user_id` field equal to X.

**Validates: Requirements 6.6**

---

### Property 6: Graceful SMTP failure — no state mutation

*For any* invocation of `send_notification_email()` that raises or catches an SMTP exception, the function SHALL return `False`, SHALL NOT re-raise the exception, and SHALL NOT modify the `tasks` list argument.

**Validates: Requirements 5.4, 5.5**

---

### Property 7: is_notified only set on email success

*For any* user whose email send fails (i.e., `send_notification_email()` returns `False`), all of that user's tasks due today SHALL retain `is_notified = False` after `daily_notification_job()` completes.

**Validates: Requirements 4.5**

---

### Property 8: Scheduler query correctness

*For any* database state, `daily_notification_job()` SHALL only process tasks where `deadline` matches today's date string, `is_notified` is `False`, and `status` is `'active'`; tasks not matching all three conditions SHALL be excluded.

**Validates: Requirements 4.2**

---

### Property 9: New task is_notified default

*For any* newly created Task with any combination of valid field values, the `is_notified` field SHALL be `False` immediately after creation.

**Validates: Requirements 1.2**

---

### Property 10: Score formula correctness

*For any* valid urgency U, importance I, severity S, and deadline D, `calculate_priority_score(U, I, S, D)` SHALL return a `score` equal to `(0.3×U + 0.4×I + 0.3×S) × (1 + 2 / (max(0, days_remaining) + 1))` within floating-point tolerance of 0.001.

**Validates: Requirements 2.2**

---

### Property 11: Cross-language score consistency

*For any* valid urgency, importance, severity, and deadline inputs, `calculate_priority_score()` in Python SHALL return a `score` within 0.01 of the value returned by `calculatePriorityScore()` in JavaScript for the same inputs.

**Validates: Requirements 8.1, 8.2**
