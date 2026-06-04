// src/hooks/useWatchSession.js
import { useEffect, useState } from 'react';
import { API_URL } from '../config';

export const useWatchSession = (channel, token) => {
  const [sessionId, setSessionId] = useState(null);  // ← useState вместо useRef

  useEffect(() => {
    if (!channel || !token) {
      console.log('⏭️ Skipping watch session - no channel or token');
      return;
    }

    let isMounted = true;

    const startSession = async () => {
      try {
        console.log('🎬 Starting watch session for channel:', channel);
        
        const response = await fetch(`${API_URL}/track/view/start`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ streamer_name: channel })
        });

        const data = await response.json();
        
        if (response.ok && data.session_id && isMounted) {
          setSessionId(data.session_id);  // ← обновляем состояние
          console.log('📊 Watch session started, ID:', data.session_id);
        } else {
          console.error('Failed to start watch session:', data);
        }
      } catch (err) {
        console.error('❌ Error starting watch session:', err);
      }
    };

    startSession();

    return () => {
      isMounted = false;
      if (sessionId) {  // ← используем sessionId из замыкания
        console.log('🏁 Ending watch session:', sessionId);
        fetch(`${API_URL}/track/view/end`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ session_id: sessionId })
        }).catch(err => console.error('Error ending session:', err));
      }
    };
  }, [channel, token]);  // ← убрал sessionId из зависимостей

  return sessionId;  // ← возвращаем состояние
};