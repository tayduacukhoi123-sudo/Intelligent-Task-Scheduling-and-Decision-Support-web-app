"""
Direct database schema fix for Neon PostgreSQL.
Adds missing columns if they don't exist.
Run this once to fix the production database.
"""
import os
import sys
from sqlalchemy import create_engine, text, inspect

def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    # Fix postgres:// to postgresql://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('task')]
        
        print(f"Current columns in 'task' table: {columns}")
        
        # Add tags column if missing
        if 'tags' not in columns:
            print("Adding 'tags' column...")
            conn.execute(text("ALTER TABLE task ADD COLUMN tags TEXT"))
            conn.commit()
            print("✓ Added 'tags' column")
        else:
            print("✓ 'tags' column already exists")
        
        # Add is_notified column if missing
        if 'is_notified' not in columns:
            print("Adding 'is_notified' column...")
            conn.execute(text("ALTER TABLE task ADD COLUMN is_notified BOOLEAN NOT NULL DEFAULT FALSE"))
            conn.commit()
            print("✓ Added 'is_notified' column")
        else:
            print("✓ 'is_notified' column already exists")
        
        # Verify final state
        columns_after = [col['name'] for col in inspector.get_columns('task')]
        print(f"\nFinal columns in 'task' table: {columns_after}")
        print("\n✅ Database schema is now correct!")

if __name__ == "__main__":
    main()
