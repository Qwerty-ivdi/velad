# app/config.py
import os
from dotenv import load_dotenv
from pathlib import Path

base_dir = Path(__file__).resolve().parent.parent
env_file = base_dir / '.env'

if env_file.exists():
    load_dotenv(dotenv_path=env_file)

class Config:
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')

    # Twitch
    TWITCH_CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
    TWITCH_CLIENT_SECRET = os.getenv('TWITCH_CLIENT_SECRET')

    # Security
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-min-32-characters-long!!')

    # JWT Settings
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', SECRET_KEY)
    JWT_TOKEN_LOCATION = ['headers']  # ✅ ОБЯЗАТЕЛЬНО
    JWT_ACCESS_TOKEN_EXPIRES = 604800  # 7 дней
    JWT_REFRESH_TOKEN_EXPIRES = 2592000  # 30 дней
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    # CORS
    CORS_ORIGINS = [
        'http://localhost:3000',
        'https://veladtwitch.vercel.app'
    ]

    print("=" * 50)
    print("🔧 CONFIGURATION:")
    print(f"DATABASE_URL exists: {bool(DATABASE_URL)}")
    print(f"TWITCH_CLIENT_ID exists: {bool(TWITCH_CLIENT_ID)}")
    print(f"SECRET_KEY exists: {bool(SECRET_KEY)}")
    print(f"JWT_TOKEN_LOCATION: {JWT_TOKEN_LOCATION}")
    print("=" * 50)