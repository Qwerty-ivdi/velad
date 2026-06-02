from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.db_service import db_service
from datetime import datetime
import requests

user_bp = Blueprint('user', __name__)


@user_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Получить профиль текущего пользователя"""
    try:
        user_id = get_jwt_identity()
        print(f"📡 Getting profile for user: {user_id}")

        user = db_service.execute_query("""
            SELECT id, email, username, display_name, avatar_url, created_at,
                   twitch_login, twitch_id
            FROM users WHERE id = %s
        """, [user_id], fetch_one=True)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': user['id'],
            'email': user['email'],
            'username': user['username'],
            'display_name': user['display_name'],
            'avatar_url': user['avatar_url'],
            'created_at': user['created_at'].isoformat() if user['created_at'] else None,
            'twitch_login': user.get('twitch_login'),
            'has_twitch': user.get('twitch_id') is not None
        }), 200

    except Exception as e:
        print(f"Error getting profile: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/test', methods=['GET'])
def test():
    print("🔥 TEST ENDPOINT CALLED! 🔥")
    return jsonify({"message": "Test works!"}), 200


@user_bp.route('/twitch-token', methods=['GET'])
@jwt_required()  # 👈 ВОЗВРАЩАЕМ JWT ПРОВЕРКУ
def get_twitch_token():
    """Вернуть валидный токен Twitch для текущего пользователя"""
    print("=" * 50)
    print("🔥 TWITCH TOKEN ENDPOINT CALLED! 🔥")
    print("=" * 50)

    try:
        # Получаем user_id из JWT токена
        user_id = get_jwt_identity()
        print(f"📡 Getting token for user_id: {user_id}")

        # Ищем пользователя по ID
        user = db_service.execute_query("""
            SELECT twitch_access_token, twitch_login, twitch_token_expires_at, id, email
            FROM users 
            WHERE id = %s
        """, [user_id], fetch_one=True)

        print(f"📡 User found: {user is not None}")

        if user:
            print(f"📡 User email: {user.get('email')}")
            print(f"📡 Twitch login: {user.get('twitch_login')}")

        if not user:
            print("❌ User NOT found!")
            return jsonify({
                'has_token': False,
                'error': 'User not found'
            }), 200

        if not user.get('twitch_access_token'):
            print("❌ No Twitch token found!")
            return jsonify({
                'has_token': False,
                'error': 'No Twitch token found. Please login with Twitch first.'
            }), 200

        # Проверяем, не истек ли токен
        expires_at = user.get('twitch_token_expires_at')
        if expires_at and expires_at <= datetime.now():
            print(f"⚠️ Token expired at {expires_at}")
            # Пробуем обновить токен
            refresh_token = user.get('twitch_refresh_token')
            if refresh_token:
                new_token = refresh_twitch_token(refresh_token)
                if new_token:
                    # Обновляем токен в БД
                    db_service.execute_query("""
                        UPDATE users 
                        SET twitch_access_token = %s,
                            twitch_token_expires_at = NOW() + INTERVAL '30 days'
                        WHERE id = %s
                    """, [new_token, user_id])
                    print(f"✅ Token refreshed for {user['twitch_login']}")
                    return jsonify({
                        'has_token': True,
                        'twitch_access_token': new_token,
                        'twitch_login': user['twitch_login']
                    }), 200
                else:
                    print("❌ Failed to refresh token")
                    return jsonify({
                        'has_token': False,
                        'error': 'Token expired and cannot be refreshed. Please re-authenticate.'
                    }), 200
            else:
                return jsonify({
                    'has_token': False,
                    'error': 'Token expired. Please re-authenticate with Twitch.'
                }), 200

        token_length = len(user['twitch_access_token'])
        print(f"✅ Returning Twitch token for {user['twitch_login']} (length: {token_length})")

        return jsonify({
            'has_token': True,
            'twitch_access_token': user['twitch_access_token'],
            'twitch_login': user['twitch_login']
        }), 200

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'has_token': False, 'error': str(e)}), 500


def refresh_twitch_token(refresh_token):
    """Обновление истёкшего токена"""
    if not refresh_token:
        return None

    url = "https://id.twitch.tv/oauth2/token"
    data = {
        'client_id': current_app.config['TWITCH_CLIENT_ID'],
        'client_secret': current_app.config['TWITCH_CLIENT_SECRET'],
        'grant_type': 'refresh_token',
        'refresh_token': refresh_token
    }

    try:
        response = requests.post(url, data=data)
        if response.status_code == 200:
            tokens = response.json()
            return tokens.get('access_token')
        else:
            print(f"❌ Token refresh failed: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error refreshing token: {e}")
        return None


@user_bp.route('/twitch/status', methods=['GET'])
@jwt_required()
def get_twitch_status():
    """Проверить, подключён ли Twitch аккаунт"""
    try:
        user_id = get_jwt_identity()
        print(f"📡 Checking Twitch status for user: {user_id}")

        user = db_service.execute_query("""
            SELECT twitch_id, twitch_login, twitch_access_token
            FROM users WHERE id = %s
        """, [user_id], fetch_one=True)

        return jsonify({
            'connected': bool(user and user.get('twitch_id') and user.get('twitch_access_token')),
            'twitch_login': user.get('twitch_login') if user else None
        }), 200

    except Exception as e:
        print(f"❌ Error checking Twitch status: {e}")
        return jsonify({'connected': False, 'error': str(e)}), 200