"""
scheduler.py — Daily Notification Scheduler

Initialises a Flask-APScheduler instance and registers the daily notification
job that emails users about tasks due today.
"""

import logging
import os
from datetime import date
from typing import Optional

from flask import Flask
from flask_apscheduler import APScheduler

from algorithm import calculate_priority_score, get_eisenhower_quadrant
from extensions import db
from mail_service import send_notification_email
from models import Task, User

logger = logging.getLogger(__name__)

# Module-level reference to the Flask app so the job function can push an
# app context without needing the app passed as an argument.
_app = None  # type: Optional[Flask]


def init_scheduler(app):
    # type: (Flask) -> None
    """
    Initialise and start the APScheduler background scheduler.

    Uses an environment-variable guard to prevent duplicate scheduler
    instances when Gunicorn spawns multiple worker processes.
    """
    global _app

    try:
        # Process guard: if another worker already set this flag, bail out.
        if os.environ.get("SCHEDULER_RUNNING"):
            logger.info("Scheduler already running in another worker — skipping init.")
            return

        os.environ["SCHEDULER_RUNNING"] = "1"

        _app = app

        scheduler = APScheduler()
        app.config["SCHEDULER_API_ENABLED"] = False
        scheduler.init_app(app)

        scheduler.add_job(
            id="daily_notification_job",
            func=daily_notification_job,
            trigger="cron",
            hour=8,
            minute=0,
        )

        scheduler.start()
        logger.info("APScheduler started — daily notification job scheduled at 08:00.")

    except Exception:
        logger.exception("init_scheduler: failed to start scheduler — app will continue without it.")


def daily_notification_job() -> None:
    """
    Cron job that runs at 08:00 every day.

    Queries tasks due today that have not yet been notified, groups them by
    user, scores and sorts them, then sends a notification email per user.
    Sets ``is_notified = True`` only when the email was accepted by the SMTP
    server.
    """
    try:
        with _app.app_context():
            today_str = date.today().isoformat()  # "YYYY-MM-DD"
            logger.info("daily_notification_job: running for date %s", today_str)

            tasks = (
                db.session.query(Task)
                .filter(
                    Task.deadline.like(f"{today_str}%"),
                    Task.is_notified == False,  # noqa: E712
                    Task.status == "active",
                )
                .all()
            )

            if not tasks:
                logger.info("daily_notification_job: no tasks due today — nothing to send.")
                return

            # Group tasks by user_id
            tasks_by_user = {}  # type: dict
            for task in tasks:
                tasks_by_user.setdefault(task.user_id, []).append(task)

            for user_id, user_tasks in tasks_by_user.items():
                user = db.session.get(User, user_id)
                if user is None:
                    logger.warning(
                        "daily_notification_job: user_id=%d not found — skipping.", user_id
                    )
                    continue

                # Score and annotate each task
                scored = []  # type: list
                for task in user_tasks:
                    result = calculate_priority_score(
                        task.urgency,
                        task.importance,
                        task.severity,
                        task.deadline,
                    )
                    quadrant = get_eisenhower_quadrant(task.urgency, task.importance)
                    scored.append(
                        {
                            "_task_obj": task,
                            "title": task.title,
                            "score": result["score"],
                            "normalized": result["normalized"],
                            "quadrant": quadrant,
                            "deadline": task.deadline,
                        }
                    )

                # Sort by score descending (highest priority first)
                scored.sort(key=lambda d: d["score"], reverse=True)

                # Build the list of dicts for the email (exclude internal key)
                task_dicts = [
                    {k: v for k, v in item.items() if k != "_task_obj"}
                    for item in scored
                ]

                success = send_notification_email(user.email, user.name, task_dicts)

                if success:
                    for item in scored:
                        item["_task_obj"].is_notified = True
                    db.session.commit()
                    logger.info(
                        "daily_notification_job: notification sent to user_id=%d (%d task(s)).",
                        user_id,
                        len(scored),
                    )
                else:
                    logger.warning(
                        "daily_notification_job: email failed for user_id=%d — is_notified NOT updated.",
                        user_id,
                    )

    except Exception:
        logger.exception("daily_notification_job: unhandled exception — job aborted.")
