# Implementation Plan: Due Date Notifications

## Overview

Implement automated daily email reminders and an in-app notification modal for tasks due today. The work is broken into six incremental phases: (1) extend the Task model with `is_notified`, (2) implement the shared Python priority engine in `algorithm.py`, (3) add the Flask-Mail and APScheduler infrastructure, (4) build the daily notification scheduler job, (5) expose the `GET /api/notifications` REST endpoint, and (6) wire up the frontend modal. Each phase builds directly on the previous one and ends with the new code fully integrated into the running application.

## Tasks

- [x] 1. Extend Task model and run database migration
  - Add `is_notified = db.Column(db.Boolean, nullable=False, default=False)` to the `Task` class in `src/models.py`
  - Remove the manual `ALTER TABLE task ADD COLUMN tags TEXT` hack from `create_app()` in `src/app.py` and replace it with a proper Flask-Migrate migration
  - Generate the migration with `flask db migrate -m "add is_notified to task"` and apply it with `flask db upgrade`; verify the migration script sets `server_default='false'` so existing rows receive `False`
  - Ensure `is_notified` is NOT included as a writable field in `create_task()` or `update_task()` in `src/routes.py`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.1 Write property test for new-task `is_notified` default
    - **Property 9: New task is_notified default**
    - For any combination of valid Task field values, assert `task.is_notified is False` immediately after `db.session.add()` + `db.session.commit()`
    - **Validates: Requirements 1.2**

- [x] 2. Implement priority engine in `algorithm.py`
  - [x] 2.1 Implement `calculate_priority_score(urgency, importance, severity, deadline_str)`
    - Parse `deadline_str` supporting both `"YYYY-MM-DD"` and `"YYYY-MM-DDTHH:MM"` formats
    - Compute `base_score = (0.3 × urgency) + (0.4 × importance) + (0.3 × severity)`
    - Compute `clamped_days = max(0, days_remaining)` and `multiplier = 1 + 2 / (clamped_days + 1)`
    - Return `{"score": round(base_score * multiplier, 2), "days_remaining": ceil(days_remaining), "total_hours": total_hours, "normalized": round(clamp(1 + (score / 30) * 9, 1.0, 10.0), 1)}`
    - On `ValueError` from date parsing, return `{"score": 0, "days_remaining": 0, "total_hours": 0, "normalized": 1.0}` without raising
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 8.1_

  - [ ]* 2.2 Write property test for normalized score bounds
    - **Property 1: Normalized score bounds**
    - Use `hypothesis` with `st.integers(min_value=1, max_value=10)` for U/I/S and a strategy for future deadline strings
    - Assert `1.0 <= result["normalized"] <= 10.0` for all generated inputs
    - **Validates: Requirements 2.3**

  - [ ]* 2.3 Write property test for score monotonicity
    - **Property 2: Score monotonicity with deadline proximity**
    - Generate fixed U/I/S and two future deadlines where `deadline_A < deadline_B` (A is closer)
    - Assert `calculate_priority_score(..., deadline_A)["score"] >= calculate_priority_score(..., deadline_B)["score"]`
    - **Validates: Requirements 2.4**

  - [ ]* 2.4 Write property test for score formula correctness
    - **Property 10: Score formula correctness**
    - For any valid U, I, S, and deadline, assert the returned `score` equals `(0.3U + 0.4I + 0.3S) × (1 + 2 / (max(0, days_remaining) + 1))` within tolerance 0.001
    - **Validates: Requirements 2.2**

  - [x] 2.5 Implement `get_eisenhower_quadrant(urgency, importance)`
    - Return `"Q1_DO_FIRST"` when `urgency >= 6` and `importance >= 6`
    - Return `"Q2_SCHEDULE"` when `urgency < 6` and `importance >= 6`
    - Return `"Q3_DELEGATE"` when `urgency >= 6` and `importance < 6`
    - Return `"Q4_ELIMINATE"` when `urgency < 6` and `importance < 6`
    - Thresholds must mirror the inline Eisenhower logic in `renderSchedule()` in `script.js`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.2_

  - [ ]* 2.6 Write property test for Eisenhower quadrant completeness
    - **Property 3: Eisenhower quadrant completeness**
    - Use `hypothesis` with `st.integers(min_value=1, max_value=10)` for both urgency and importance
    - Assert the return value is one of exactly four valid strings and is deterministic across repeated calls with the same inputs
    - **Validates: Requirements 3.1, 3.6**

- [ ] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add Flask-Mail and Flask-APScheduler infrastructure
  - [x] 4.1 Update `src/requirements.txt` with pinned new dependencies
    - Add `Flask-Mail==0.10.0` and `Flask-APScheduler==1.13.1` to `src/requirements.txt`
    - _Requirements: 9.3_

  - [x] 4.2 Add `Mail` extension to `src/extensions.py`
    - Import `Flask-Mail`'s `Mail` class and create a module-level `mail = Mail()` instance alongside the existing `db` and `migrate` instances
    - _Requirements: 9.4_

  - [x] 4.3 Wire mail and scheduler into `create_app()` in `src/app.py`
    - Read SMTP config from env vars `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER` and set them on `app.config`
    - Log a clear warning for each missing required SMTP env var at startup
    - Call `mail.init_app(app)` after `db.init_app(app)`
    - Call `init_scheduler(app)` (imported from `scheduler.py`) after `mail.init_app(app)`
    - _Requirements: 9.1, 9.2, 9.4_

- [x] 5. Implement `mail_service.py` — email construction and sending
  - Create `src/mail_service.py` with `send_notification_email(recipient_email, recipient_name, tasks)`
  - Build an HTML email body listing each task's title, priority score, Eisenhower quadrant label, and deadline; include a plain-text fallback body in the same `Message` object
  - Use Flask-Mail's `Message` with `current_app` to access the mail extension
  - Catch `smtplib.SMTPException` and any `Exception` during send; log the error without exposing SMTP credentials; return `False`
  - Return `True` on successful send; never mutate the `tasks` list argument
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.1 Write property test for graceful SMTP failure — no state mutation
    - **Property 6: Graceful SMTP failure — no state mutation**
    - Mock `mail.send` to raise `smtplib.SMTPException`; call `send_notification_email()` with a sample task list
    - Assert the function returns `False`, does not re-raise, and the `tasks` list is unchanged after the call
    - **Validates: Requirements 5.4, 5.5**

- [x] 6. Implement `scheduler.py` — daily notification job
  - Create `src/scheduler.py` with `init_scheduler(app)` and `daily_notification_job()`
  - In `init_scheduler`, use `os.environ.setdefault('SCHEDULER_RUNNING', '1')` as a process guard; only start the scheduler if this call returns `None` (i.e., the key was not already set), preventing duplicate scheduler instances under Gunicorn multi-worker deployments
  - Register `daily_notification_job` as a cron trigger at `hour=8, minute=0` using `APScheduler`
  - In `daily_notification_job`, push the Flask app context, then query `Task` records where `deadline LIKE 'YYYY-MM-DD%'`, `is_notified == False`, and `status == 'active'`
  - Group tasks by `user_id`; for each user, score and sort tasks using `calculate_priority_score()` and `get_eisenhower_quadrant()`, then call `send_notification_email()`
  - Set `is_notified = True` and commit only if `send_notification_email()` returns `True`; log and skip commit on `False`
  - Wrap the entire job body in a `try/except Exception` to prevent app crashes; log any unhandled exception
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 6.1 Write property test for notification idempotency
    - **Property 4: Notification idempotency**
    - Seed an in-memory SQLite DB with tasks that have `is_notified = True`; run `daily_notification_job()` with mocked mail
    - Assert `send_notification_email` was never called and no `is_notified` values changed
    - **Validates: Requirements 4.6**

  - [ ]* 6.2 Write property test for scheduler query correctness
    - **Property 8: Scheduler query correctness**
    - Seed tasks with varying combinations of `deadline`, `is_notified`, and `status`; run the job with mocked mail
    - Assert only tasks matching all three conditions (`deadline == today`, `is_notified == False`, `status == 'active'`) were passed to `send_notification_email`
    - **Validates: Requirements 4.2**

  - [ ]* 6.3 Write property test for `is_notified` only set on email success
    - **Property 7: is_notified only set on email success**
    - Mock `send_notification_email` to return `False`; run `daily_notification_job()` with tasks due today
    - Assert all tasks retain `is_notified == False` after the job completes
    - **Validates: Requirements 4.5**

- [ ] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add `GET /api/notifications` endpoint to `routes.py`
  - Add a `GET /api/notifications` route to `src/routes.py`
  - Return HTTP 400 `{"error": "user_id required"}` if `user_id` query param is absent
  - Return HTTP 404 `{"error": "User not found"}` if no `User` record matches the given `user_id`
  - Query `Task` records for that user where `deadline` starts with today's date string and `status == 'active'`
  - For each task, call `calculate_priority_score()` and `get_eisenhower_quadrant()` from `algorithm.py`
  - Return HTTP 200 with a JSON array containing `id`, `title`, `urgency`, `importance`, `severity`, `deadline`, `score`, `normalized_score`, `quadrant`, `tags` (parsed from JSON string), and `is_notified` for each task
  - Return HTTP 200 with `[]` when no tasks are due today for that user
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 8.1 Write property test for user isolation in notifications endpoint
    - **Property 5: User isolation in notifications endpoint**
    - Seed two users each with tasks due today; call `GET /api/notifications?user_id=X` for each user
    - Assert every task in the response has `user_id` equal to the requested user's ID
    - **Validates: Requirements 6.6**

- [x] 9. Add frontend notification UI to `script.js`
  - [x] 9.1 Implement `checkDueNotifications()` in `src/static/script.js`
    - Add an `async function checkDueNotifications()` that fetches `GET /api/notifications?user_id=${getUserId()}`
    - If the response is non-200 or the fetch throws, log a warning with `console.warn` and return without crashing
    - If the response contains one or more tasks, call `showDueModal(tasks)`
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 9.2 Implement `showDueModal(tasks)` in `src/static/script.js`
    - Add a `function showDueModal(tasks)` that creates or reuses a modal overlay element
    - Render a heading "You have X task(s) due today!" and a list of each task showing its title, Eisenhower quadrant badge (reuse existing quadrant CSS classes or inline badge styles), and normalized score
    - Include a close/dismiss button that removes the modal from the DOM
    - Reuse existing `.modal-overlay` / `.modal-content` CSS classes from the existing confirm modal pattern
    - _Requirements: 7.3_

  - [x] 9.3 Call `checkDueNotifications()` on dashboard page load only
    - In the `DOMContentLoaded` listener (or the existing page-routing block), call `checkDueNotifications()` only when the current page is the dashboard (`index.html` or `/`)
    - Do NOT call it on `task.html`, `schedule.html`, or `history.html`
    - _Requirements: 7.1, 7.5_

- [x] 10. Update `render.yaml` with new environment variable keys
  - Add the six new SMTP env var keys (`MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER`) to `render.yaml` as environment variable entries (values left as placeholders or marked `sync: false`)
  - _Requirements: 9.1_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Property tests require `hypothesis` to be added to the test dependencies (not production `requirements.txt`)
- The process guard in `scheduler.py` (task 6) is critical for Render deployments — do not skip it
- The manual `ALTER TABLE` hack in `app.py` (task 1) must be removed before the migration is applied to avoid conflicts
- All score calculations in the backend must use `algorithm.py` exclusively — do not duplicate the formula in `routes.py` or `scheduler.py`
- SMTP credentials must never be logged or returned in API responses
