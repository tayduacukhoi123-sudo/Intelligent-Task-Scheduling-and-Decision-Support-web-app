"""
Update database schema to add completed_at column.
Works for both SQLite (local) and PostgreSQL (Neon).
"""
import os
import sys
from sqlalchemy import create_engine, text, inspect

def main():
    database_url = os.getenv("DATABASE_URL", "sqlite:///instance/database.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    print(f"Connecting to database at {database_url}...")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        if 'task' not in inspector.get_table_names():
            print("ERROR: 'task' table not found.")
            return

        columns = [col['name'] for col in inspector.get_columns('task')]
        
        if 'completed_at' not in columns:
            print("Adding 'completed_at' column...")
            try:
                conn.execute(text("ALTER TABLE task ADD COLUMN completed_at DATETIME"))
                conn.commit()
                print("DONE: Added 'completed_at' column")
            except Exception as e:
                print(f"Error adding column: {e}")
        else:
            print("OK: 'completed_at' column already exists")
        
        print("\nDatabase schema is up to date!")

if __name__ == "__main__":
    main()
