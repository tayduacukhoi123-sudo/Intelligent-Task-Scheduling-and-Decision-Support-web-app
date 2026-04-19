#!/bin/bash
# Startup script for Render deployment
# Runs database migrations before starting the app

echo "Running database migrations..."
flask db upgrade

echo "Starting Gunicorn server..."
exec gunicorn app:app
