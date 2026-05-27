-- ============================================================
-- SQL Schema for Task Priority Manager
-- Matches actual SQLAlchemy models (User, Task, Schedule)
-- Compatible with SQLite and PostgreSQL
-- ============================================================

-- Drop tables if they exist to allow clean re-initialization
DROP TABLE IF EXISTS schedule;
DROP TABLE IF EXISTS task;
DROP TABLE IF EXISTS "user";

-- 1. User Table
CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL
);

-- 2. Task Table
CREATE TABLE task (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    user_id INT NOT NULL,
    urgency INT NOT NULL DEFAULT 1,
    importance INT NOT NULL DEFAULT 1,
    severity INT NOT NULL DEFAULT 1,
    deadline VARCHAR(50) NOT NULL,
    duration_minutes INT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    is_notified BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
);

-- 3. Schedule Table
CREATE TABLE schedule (
    id SERIAL PRIMARY KEY,
    scheduled_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    task_id INT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES task (id) ON DELETE CASCADE
);
