import sys
import os

# Добавляем путь к проекту
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.services.db_service import db_service


def init_database():
    """Инициализация базы данных"""

    # SQL для создания таблиц
    tables_sql = """
    -- Таблица пользователей
    CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        avatar_url TEXT,
        bio TEXT,
        location VARCHAR(100),
        website VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Таблица профилей
    CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        email VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        location VARCHAR(100),
        website VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Таблица постов
    CREATE TABLE IF NOT EXISTS posts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT,
        post_type VARCHAR(20) DEFAULT 'text',
        media_urls TEXT[],
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Таблица подписок
    CREATE TABLE IF NOT EXISTS follows (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(follower_id, following_id)
    );

    -- Таблица лайков
    CREATE TABLE IF NOT EXISTS post_likes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(post_id, user_id)
    );

    -- Таблица комментариев
    CREATE TABLE IF NOT EXISTS comments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    """

    app = create_app()

    with app.app_context():
        try:
            # Проверка подключения
            result = db_service.execute_query("SELECT 1 as test")
            print("✅ Database connection successful!")

            # Создаем таблицы
            print("📝 Creating tables...")
            db_service.execute_query(tables_sql)
            print("✅ All tables created successfully!")

            # Проверка созданных таблиц
            tables = db_service.execute_query("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename
            """)

            print("\n📊 Existing tables:")
            for table in tables:
                print(f"   - {table['tablename']}")

        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    init_database()