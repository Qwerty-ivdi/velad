# app/services/db_service.py
import psycopg
from psycopg.rows import dict_row
from flask import current_app
import uuid


class DatabaseService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def init_app(self, app):
        """Инициализация"""
        pass

    def _convert_uuid(self, obj):
        """Рекурсивно конвертирует UUID в строку"""
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, dict):
            return {k: self._convert_uuid(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self._convert_uuid(item) for item in obj]
        return obj

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
        """
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)

                if return_id:
                    result = cur.fetchone()
                    conn.commit()
                    return self._convert_uuid(result)
                elif fetch_one:
                    result = cur.fetchone()
                    conn.commit()
                    return self._convert_uuid(result)
                elif fetch_all:
                    result = cur.fetchall()
                    conn.commit()
                    return self._convert_uuid(result)
                else:
                    conn.commit()
                    return cur.rowcount
        finally:
            conn.close()


db_service = DatabaseService()