CREATE TABLE User ( 
id          INT AUTO_INCREMENT PRIMARY KEY,
email       VARCHAR(255) NOT NULL UNIQUE,
name        VARCHAR(255) NOT NULL,
avatar      VARCHAR(500),
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Task (
id              INT AUTO_INCREMENT PRIMARY KEY,
user_id         INT NOT NULL,
title           VARCHAR(255) NOT NULL,
urgency         INT NOT NULL CHECK (urgency BETWEEN 1 AND 5),
importance      INT NOT NULL CHECK (importance BETWEEN 1 AND 5),
estimated_time  INT NOT NULL COMMENT 'in minutes',
flexibility     BOOLEAN DEFAULT FALSE,
status          ENUM('pending', 'done', 'late', 'cancelled') DEFAULT 'pending',
 created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE Schedule (
  id          INT AUTO_INCREMENT PRIMARY KEY,
 user_id     INT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
);

CREATE TABLE ScheduleItem (
id              INT AUTO_INCREMENT PRIMARY KEY, 
schedule_id     INT NOT NULL,
task_id         INT NOT NULL,
score           FLOAT NOT NULL,
quadrant        ENUM('do_first', 'schedule', 'delegate', 'eliminate') NOT NULL,
item_order      INT NOT NULL,
assigned_time   DATETIME,
FOREIGN KEY (schedule_id) REFERENCES Schedule(id) ON DELETE CASCADE,
FOREIGN KEY (task_id) REFERENCES Task(id) ON DELETE CASCADE
);

CREATE TABLE TaskHistory (
id          INT AUTO_INCREMENT PRIMARY KEY,
task_id     INT NOT NULL,
user_id     INT NOT NULL,
old_status  ENUM('pending', 'done', 'late', 'cancelled'),
new_status  ENUM('pending', 'done', 'late', 'cancelled') NOT NULL,
changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
note        TEXT,
FOREIGN KEY (task_id) REFERENCES Task(id) ON DELETE CASCADE,
FOREIGN KEY (user_id) REFERENCES User(id) ON DELETE CASCADE
);
