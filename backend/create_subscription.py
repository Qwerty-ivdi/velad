#!/usr/bin/env python
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.services.eventsub_service import eventsub_service
from app.services.db_service import db_service


def create_chat_subscription():
    """Создание подписки на события чата"""
    app, _ = create_app()

    with app.app_context():
        # Получаем ID стримера (например, mazellovvv)
        streamer_login = input("Введите логин стримера: ").strip()

        # Получаем ID пользователя из Twitch
        import requests
        access_token = eventsub_service.get_app_access_token()

        if not access_token:
            print("❌ Failed to get access token")
            return

        # Получаем ID стримера
        headers = {
            'Client-ID': app.config['TWITCH_CLIENT_ID'],
            'Authorization': f'Bearer {access_token}'
        }

        user_response = requests.get(
            f"https://api.twitch.tv/helix/users?login={streamer_login}",
            headers=headers
        )

        if user_response.status_code != 200:
            print(f"❌ Failed to get user info: {user_response.text}")
            return

        user_data = user_response.json()
        if not user_data.get('data'):
            print(f"❌ User {streamer_login} not found")
            return

        broadcaster_id = user_data['data'][0]['id']
        public_url = app.config.get('PUBLIC_URL')
        callback_url = f"{public_url}/webhooks/twitch"

        print(f"📝 Creating subscription for {streamer_login} (ID: {broadcaster_id})")
        print(f"📡 Callback URL: {callback_url}")

        result = eventsub_service.create_subscription(
            broadcaster_id=broadcaster_id,
            callback_url=callback_url,
            subscription_type='channel.chat.message'
        )

        if result.get('data'):
            print(f"✅ Subscription created: {result['data'][0]['id']}")
        else:
            print(f"❌ Failed to create subscription: {result}")


def list_subscriptions():
    """Просмотр всех подписок"""
    app, _ = create_app()
    with app.app_context():
        subscriptions = eventsub_service.get_subscriptions()
        print(f"📋 Found {len(subscriptions)} subscriptions:")
        for sub in subscriptions:
            print(f"  - {sub['id']}: {sub['type']} -> {sub['transport']['callback']}")


def delete_subscription():
    """Удаление подписки"""
    subscription_id = input("Введите ID подписки для удаления: ").strip()
    app, _ = create_app()
    with app.app_context():
        if eventsub_service.delete_subscription(subscription_id):
            print(f"✅ Subscription {subscription_id} deleted")
        else:
            print(f"❌ Failed to delete subscription")


if __name__ == '__main__':
    print("Twitch EventSub Manager")
    print("1. Создать подписку на чат")
    print("2. Просмотреть все подписки")
    print("3. Удалить подписку")

    choice = input("Выберите действие (1-3): ").strip()

    if choice == '1':
        create_chat_subscription()
    elif choice == '2':
        list_subscriptions()
    elif choice == '3':
        delete_subscription()
    else:
        print("Неверный выбор")