# app/services/db_service.py
import psycopg
from psycopg.rows import dict_row
from flask import current_app


class DatabaseService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def init_app(self, app):
        """Инициализация (пока ничего не делает, но нужен для совместимости)"""
        pass  # Можешь добавить проверку подключения позже

    def get_connection(self):
        """Получение подключения к БД"""
        return psycopg.connect(
            current_app.config['DATABASE_URL'],
            row_factory=dict_row,
            sslmode='require'
        )

    def execute_query(self, query, params=None, fetch_one=False, fetch_all=False, return_id=False):
        """
        Выполнение SQL запроса
        - fetch_one: вернуть одну строку
        - fetch_all: вернуть все строки
        - return_id: вернуть ID вставленной записи (для INSERT с RETURNING)
        """
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)

                if return_id:
                    result = cur.fetchone()
                    conn.commit()
                    return result
                elif fetch_one:
                    result = cur.fetchone()
                    conn.commit()
                    return result
                elif fetch_all:
                    result = cur.fetchall()
                    conn.commit()
                    return result
                else:
                    conn.commit()
                    return cur.rowcount
        finally:
            conn.close()


db_service = DatabaseService()