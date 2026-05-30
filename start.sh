#!/bin/bash
# Startup script for Render deployment
# Runs migrations before starting the app

echo "Running database migrations..."
flask db upgrade || echo "Migration failed or already applied"

echo "Starting Gunicorn server..."
exec gunicorn app:app
