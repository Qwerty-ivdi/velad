import os
from dotenv import load_dotenv
from pathlib import Path

# Загружаем .env
base_dir = Path(__file__).resolve().parent.parent
env_file = base_dir / '.env'

if env_file.exists():
    load_dotenv(dotenv_path=env_file)
    print(f"✅ .env loaded from {env_file}")
else:
    load_dotenv()
    print("⚠️ .env not found, using system env")


class Config:
    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')

    # PostgreSQL
    DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL')

    # Twitch
    TWITCH_CLIENT_ID = os.getenv('TWITCH_CLIENT_ID')
    TWITCH_CLIENT_SECRET = os.getenv('TWITCH_CLIENT_SECRET')

    # Секретный ключ
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-min-32-charswadassddadaadadswda')

    # CORS настройки
    CORS_ORIGINS = [
        'http://localhost:3000',
        'https://velad.vercel.app',
        'https://velad-*.vercel.app'
    ]
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', SECRET_KEY)
    # Проверка
    print("=" * 50)
    print("🔧 CONFIGURATION:")
    print(f"DATABASE_URL exists: {bool(DATABASE_URL)}")
    print(f"SUPABASE_URL exists: {bool(SUPABASE_URL)}")
    print(f"TWITCH_CLIENT_ID exists: {bool(TWITCH_CLIENT_ID)}")
    print(f"TWITCH_CLIENT_SECRET exists: {bool(TWITCH_CLIENT_SECRET)}")
    print(f"SECRET_KEY exists: {bool(SECRET_KEY)}")
    print("=" * 50)