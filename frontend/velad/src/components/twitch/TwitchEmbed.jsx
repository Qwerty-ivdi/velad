import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/supabase';

const TwitchEmbed = ({ channel, token }) => {
  useEffect(() => {
    // Начать отслеживание когда плеер загрузился
    startWatching();
    
    // Heartbeat каждые 30 секунд
    const interval = setInterval(() => {
      sendHeartbeat();
    }, 30000);
    
    return () => {
      clearInterval(interval);
      endWatching();
    };
  }, []);
  
  return (
    <iframe
      src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`}
      allowFullScreen
    />
  );
};

export default TwitchEmbed;