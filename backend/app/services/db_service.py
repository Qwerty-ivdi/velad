# app/services/db_service.py
import psycopg2
import psycopg2.extras
from flask import current_app


class DatabaseService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def init_app(self, app):
        """Инициализация (пока ничего не делает, но нужен для совместимости)"""
        pass

    def get_connection(self):
        """Получение подключения к БД"""
        return psycopg2.connect(
            current_app.config['DATABASE_URL'],
            cursor_factory=psycopg2.extras.RealDictCursor,
            sslmode='require'
        )

    def execute_query(self, query, params=None, fetch_one=False, fetch_all=False):
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    # Добавляем отладку
                    print(f"🔍 Executing query: {query[:100]}...")
                    print(f"🔍 Params: {params}")

                    cur.execute(query, params)

                    if fetch_one:
                        row = cur.fetchone()
                        if row:
                            # RealDictRow уже является словарём
                            result = dict(row)
                            print(f"🔍 Result: {result}")
                            return result
                        return None
                    if fetch_all:
                        rows = cur.fetchall()
                        if rows:
                            result = [dict(row) for row in rows]
                            print(f"🔍 Result count: {len(result)}")
                            return result
                        return []
                    conn.commit()
                    return cur.rowcount
        except Exception as e:
            print(f"Database error: {e}")
            raise


db_service = DatabaseService()