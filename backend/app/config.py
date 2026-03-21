import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    
    # CORS настройки
    CORS_ORIGINS = [
        'http://localhost:3000',
        'https://velad.vercel.app'
    ]