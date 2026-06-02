// src/hooks/useWatchSession.js
import { useEffect, useRef } from 'react';

export const useWatchSession = (channel, token) => {
  const sessionIdRef = useRef(null);

  useEffect(() => {
    if (!channel || !token) {
      console.log('⏭️ Skipping watch session - no channel or token');
      return;
    }

    const startSession = async () => {
      try {
        console.log('🎬 Starting watch session for channel:', channel);
        
        const response = await fetch('http://localhost:5000/api/track/view/start', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ streamer_name: channel })
        });

        console.log('📡 Response status:', response.status);
        
        const data = await response.json();
        console.log('📡 Response data:', data);
        
        if (response.ok && data.session_id) {
          sessionIdRef.current = data.session_id;
          console.log('📊 Watch session started, ID:', sessionIdRef.current);
        } else {
          console.error('Failed to start watch session:', data);
        }
      } catch (err) {
        console.error('❌ Error starting watch session:', err);
      }
    };

    startSession();

    return () => {
      if (sessionIdRef.current) {
        console.log('🏁 Ending watch session:', sessionIdRef.current);
        fetch('http://localhost:5000/api/track/view/end', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ session_id: sessionIdRef.current })
        }).catch(err => console.error('Error ending session:', err));
      }
    };
  }, [channel, token]);

  return sessionIdRef.current;
};