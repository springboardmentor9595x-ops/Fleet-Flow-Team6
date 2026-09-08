from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

db_url = settings.DATABASE_URL

# Attempt PostgreSQL connection; if unavailable or error, fall back to SQLite for seamless execution
try:
    if db_url and db_url.startswith("postgresql"):
        engine = create_engine(db_url, echo=False, pool_pre_ping=True)
        # Test connection
        with engine.connect() as conn:
            pass
    else:
        engine = create_engine("sqlite:///./fleetflow.db", echo=False, connect_args={"check_same_thread": False})
except Exception as e:
    print(f"[Database Notice] Could not connect to PostgreSQL ({e}). Falling back to SQLite database.")
    engine = create_engine("sqlite:///./fleetflow.db", echo=False, connect_args={"check_same_thread": False})

# Create database session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for all models
Base = declarative_base()


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()