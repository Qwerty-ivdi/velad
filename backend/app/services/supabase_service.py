from supabase import create_client, Client
from flask import current_app

class SupabaseService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.client = None
        return cls._instance
    
    def init_app(self, app):
        """Инициализация клиента Supabase"""
        self.client: Client = create_client(
            app.config['SUPABASE_URL'],
            app.config['SUPABASE_KEY']
        )
    
    def get_client(self):
        return self.client

supabase_service = SupabaseService()