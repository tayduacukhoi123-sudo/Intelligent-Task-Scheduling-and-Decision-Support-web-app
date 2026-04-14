import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .flaskenv or .env if present locally
load_dotenv(".flaskenv")

def sync_db():
    # 1. Get the Database URL
    # If running locally, you might want to paste your Neon URL here temporarily 
    # or set it in your environment/terminal.
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        print("❌ Error: DATABASE_URL not found in environment.")
        print("Please set it in your terminal:")
        print("Windows (CMD): set DATABASE_URL=your_neon_url")
        print("Windows (PowerShell): $env:DATABASE_URL=\"your_neon_url\"")
        return

    # Fix for Heroku/Render standard postgres:// vs postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    print(f"🔄 Connecting to database...")
    
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()

        # 2. Check and Add duration_minutes
        print("📝 Checking for 'duration_minutes' column in 'task' table...")
        
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='task' AND column_name='duration_minutes';
        """)
        
        if not cur.fetchone():
            print("➕ Column missing. Adding 'duration_minutes'...")
            cur.execute("ALTER TABLE task ADD COLUMN duration_minutes INTEGER;")
            print("✅ Column 'duration_minutes' added successfully.")
        else:
            print("ℹ️ Column 'duration_minutes' already exists.")

        # 3. Future column checks can go here
        
        cur.close()
        conn.close()
        print("\n✨ Database schema sync complete!")
        print("You can now refresh your Render site.")

    except Exception as e:
        print(f"❌ Database error: {e}")

if __name__ == "__main__":
    sync_db()
