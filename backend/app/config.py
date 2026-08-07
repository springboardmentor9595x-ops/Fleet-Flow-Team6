from pydantic_settings import BaseSettings, SettingsConfigDict

#from sqlalchemy import create_engine
#from sqlalchemy.orm import sessionmaker, declarative_base
#from dotenv import load_dotenv
#import os
#
#load_dotenv()
#
#DATABASE_URL = os.getenv("DATABASE_URL")
#
#engine = create_engine(DATABASE_URL)
#
#SessionLocal = sessionmaker(
#    autocommit=False,
#    autoflush=False,
#    bind=engine
#)
#
#Base = declarative_base()
#
#def get_db():
#    db = SessionLocal()
#    try:
#        yield db
#    finally:
#        db.close()



class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""
    EMAIL_FROM: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    GOOGLE_MAPS_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    def __init__(self, **values):
        super().__init__(**values)
        # Ensure string settings are stripped of any quotes, spaces, or carriage returns (\r, \n)
        for key in ["EMAIL_HOST", "EMAIL_USER", "EMAIL_PASSWORD", "EMAIL_FROM"]:
            val = getattr(self, key, "")
            if isinstance(val, str):
                cleaned = val.strip().strip("'\"").strip()
                setattr(self, key, cleaned)


settings = Settings()