// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import socketService from '../services/socket';
import { api } from '../lib/supabase';

let isSocketInitialized = false;

export const useSocket = () => {
  const socketRef = useRef(null);

  useEffect(() => {
    const initSocket = () => {
      const token = api.getToken();
      if (!token) return;
      
      if (!isSocketInitialized) {
        console.log('🔌 Initializing global socket connection');
        socketService.connect(token);
        isSocketInitialized = true;
      }
      socketRef.current = socketService.getSocket();
    };

    initSocket();

    return () => {
      // Не отключаем сокет при размонтировании — он нужен для всего приложения
      // socketService.disconnect();
    };
  }, []);

  return socketService;
};