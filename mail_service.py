"""
mail_service.py — Email Construction and Sending

Builds and sends the HTML notification email for tasks due today.
Uses Flask-Mail's Message class and the mail extension from extensions.py.
"""

import logging
import smtplib

from flask import current_app
from flask_mail import Message

from extensions import mail

logger = logging.getLogger(__name__)

# Quadrant label mapping (human-readable with emoji)
QUADRANT_LABELS = {
    "Q1_DO_FIRST":   "🔴 Do First",
    "Q2_SCHEDULE":   "🔵 Schedule",
    "Q3_DELEGATE":   "🟡 Delegate",
    "Q4_ELIMINATE":  "⚪ Eliminate",
}


def _build_html_body(recipient_name: str, tasks: list) -> str:
    """Build the HTML email body listing each task."""
    rows_html = ""
    for task in tasks:
        quadrant_raw = task.get("quadrant", "")
        quadrant_label = QUADRANT_LABELS.get(quadrant_raw, quadrant_raw)
        deadline = task.get("deadline", "N/A")
        title = task.get("title", "Untitled")
        normalized = task.get("normalized", task.get("normalized_score", "N/A"))

        rows_html += f"""
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827;">
            {title}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: center;">
            {normalized}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: center;">
            {quadrant_label}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: center;">
            {deadline}
          </td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tasks Due Today</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background-color: #ffffff; border-radius: 8px;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color: #4f46e5; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                📋 Task Reminder
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 32px 8px 32px;">
              <p style="margin: 0; font-size: 16px; color: #374151;">
                Hi <strong>{recipient_name}</strong>,
              </p>
              <p style="margin: 12px 0 0 0; font-size: 15px; color: #6b7280;">
                You have <strong>{len(tasks)} task(s)</strong> due today.
                Here's your priority-sorted list:
              </p>
            </td>
          </tr>

          <!-- Task Table -->
          <tr>
            <td style="padding: 16px 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; color: #6b7280;
                                font-weight: 600; border-bottom: 2px solid #e5e7eb;">
                      Task
                    </th>
                    <th style="padding: 10px 12px; text-align: center; color: #6b7280;
                                font-weight: 600; border-bottom: 2px solid #e5e7eb;">
                      Priority Score
                    </th>
                    <th style="padding: 10px 12px; text-align: center; color: #6b7280;
                                font-weight: 600; border-bottom: 2px solid #e5e7eb;">
                      Quadrant
                    </th>
                    <th style="padding: 10px 12px; text-align: center; color: #6b7280;
                                font-weight: 600; border-bottom: 2px solid #e5e7eb;">
                      Deadline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows_html}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 16px 32px;
                        border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                This is an automated reminder from your Task Scheduler.
                Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return html


def _build_plain_body(recipient_name: str, tasks: list) -> str:
    """Build the plain-text fallback email body."""
    lines = [
        f"Hi {recipient_name},",
        "",
        f"You have {len(tasks)} task(s) due today:",
        "",
    ]
    for i, task in enumerate(tasks, start=1):
        quadrant_raw = task.get("quadrant", "")
        quadrant_label = QUADRANT_LABELS.get(quadrant_raw, quadrant_raw)
        deadline = task.get("deadline", "N/A")
        title = task.get("title", "Untitled")
        normalized = task.get("normalized", task.get("normalized_score", "N/A"))

        lines.append(f"{i}. {title}")
        lines.append(f"   Priority Score : {normalized}")
        lines.append(f"   Quadrant       : {quadrant_label}")
        lines.append(f"   Deadline       : {deadline}")
        lines.append("")

    lines.append("This is an automated reminder from your Task Scheduler.")
    return "\n".join(lines)


def send_notification_email(
    recipient_email: str,
    recipient_name: str,
    tasks: list,
) -> bool:
    """
    Send a styled HTML notification email listing today's due tasks.

    Args:
        recipient_email: Destination email address.
        recipient_name:  Display name of the recipient.
        tasks:           List of task dicts (not mutated). Each dict must contain
                         at minimum: title, score, normalized, quadrant, deadline.

    Returns:
        True  — SMTP server accepted the message.
        False — Any SMTP or unexpected error occurred (logged, never re-raised).
    """
    subject = f"📋 You have {len(tasks)} task(s) due today!"

    html_body = _build_html_body(recipient_name, tasks)
    plain_body = _build_plain_body(recipient_name, tasks)

    msg = Message(
        subject=subject,
        recipients=[recipient_email],
        body=plain_body,
        html=html_body,
    )

    try:
        mail.send(msg)
        return True
    except smtplib.SMTPException as exc:
        # Log the error type and a safe message — never include credentials
        logger.error(
            "SMTP error sending notification to %s: %s",
            recipient_email,
            type(exc).__name__,
        )
        return False
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Unexpected error sending notification to %s: %s",
            recipient_email,
            type(exc).__name__,
        )
        return False
