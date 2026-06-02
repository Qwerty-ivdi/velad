# app/services/db_service.py
import asyncpg
import os
from flask import current_app

class DatabaseService:
    _instance = None
    _pool = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def init_app(self, app):
        """Инициализация пула соединений"""
        self.app = app

    async def get_pool(self):
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                current_app.config['DATABASE_URL'],
                min_size=1,
                max_size=10
            )
        return self._pool

    def execute_query(self, query, params=None, fetch_one=False, fetch_all=False):
        """Выполнение SQL запроса (синхронная обёртка)"""
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            self._execute_query_async(query, params, fetch_one, fetch_all)
        )

    async def _execute_query_async(self, query, params, fetch_one, fetch_all):
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            if fetch_one:
                row = await conn.fetchrow(query, *params if params else [])
                return dict(row) if row else None
            if fetch_all:
                rows = await conn.fetch(query, *params if params else [])
                return [dict(row) for row in rows]
            result = await conn.execute(query, *params if params else [])
            return result

db_service = DatabaseService()