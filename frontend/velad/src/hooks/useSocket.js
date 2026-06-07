// src/hooks/useSocket.js
import { useEffect } from 'react';
import socketService from '../services/socket';
import { api } from '../lib/supabase';

export const useSocket = () => {
  useEffect(() => {
    const token = api.getToken();
    const user = api.getUser();
    
    if (!token || !user?.id) {
      console.log('⏭️ No token or user, skipping socket');
      return;
    }
    
    console.log(`🔌 Initializing socket for user ${user.id}`);
    socketService.connect(user.id, token);
    
    // При размонтировании НЕ отключаем сокет — он нужен для всего приложения
  }, []);
};