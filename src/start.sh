#!/bin/bash
# Startup script for Render deployment
# Fixes database schema and runs migrations before starting the app

echo "Fixing database schema..."
python fix_db_schema.py

echo "Running database migrations..."
flask db upgrade || echo "Migration failed or already applied"

echo "Starting Gunicorn server..."
exec gunicorn app:app
