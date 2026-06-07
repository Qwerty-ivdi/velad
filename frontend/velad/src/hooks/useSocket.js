// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import socketService from '../services/socket';
import { api } from '../lib/supabase';

let globalInitDone = false;

export const useSocket = () => {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const initSocket = () => {
      const token = api.getToken();
      if (!token) return;
      
      // Только один раз глобально
      if (!globalInitDone && mountedRef.current) {
        console.log('🔌 Initializing socket (once)');
        socketService.connect(token);
        globalInitDone = true;
      }
    };

    initSocket();

    return () => {
      mountedRef.current = false;
      // НЕ отключаем сокет при размонтировании компонента
      // socketService.disconnect();
    };
  }, []);

  return socketService;
};