# app/services/twitch_service.py
import requests
from datetime import datetime, timedelta


class TwitchService:
    def __init__(self):
        self.client_id = None
        self.client_secret = None
        self.app_access_token = None
        self.token_expires_at = None

    def init_app(self, app):
        self.client_id = app.config.get('TWITCH_CLIENT_ID')
        self.client_secret = app.config.get('TWITCH_CLIENT_SECRET')
        print(f"✅ Twitch service initialized")

    def get_app_access_token(self):
        """Получение App Access Token (не требует пользователя)"""
        if self.app_access_token and self.token_expires_at and datetime.now() < self.token_expires_at:
            return self.app_access_token

        if not self.client_id or not self.client_secret:
            print("❌ Twitch Client ID or Secret not configured")
            return None

        url = "https://id.twitch.tv/oauth2/token"
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'client_credentials'
        }

        try:
            response = requests.post(url, data=data)
            if response.status_code == 200:
                result = response.json()
                self.app_access_token = result['access_token']
                self.token_expires_at = datetime.now() + timedelta(seconds=result['expires_in'])
                print(f"✅ Got App Access Token, expires in {result['expires_in']} seconds")
                return self.app_access_token
            else:
                print(f"❌ Failed to get app access token: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Error getting app access token: {e}")
            return None


twitch_service = TwitchService()