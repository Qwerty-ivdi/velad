// src/components/twitch/TwitchChat.jsx
import React, { useEffect, useRef } from 'react';
import { api } from '../../lib/supabase';

const TwitchChat = ({ channel, token, onMessageSent }) => {
  const chatContainerRef = useRef(null);
  const chatEmbedRef = useRef(null);

  useEffect(() => {
    if (!channel || !window.Twitch) return;

    // Загружаем Twitch Embed JS
    const script = document.createElement('script');
    script.src = 'https://embed.twitch.tv/embed/v1.js';
    script.async = true;
    script.onload = () => {
      chatEmbedRef.current = new window.Twitch.Embed(chatContainerRef.current, {
        width: '100%',
        height: '100%',
        channel: channel,
        layout: 'chat',
        parent: [window.location.hostname]
      });
      
      // Слушаем события чата (ограниченная поддержка)
      chatEmbedRef.current.addEventListener(Twitch.Embed.READY, () => {
        console.log('Chat ready');
      });
    };
    
    document.body.appendChild(script);
    
    return () => {
      if (chatEmbedRef.current) {
        chatEmbedRef.current.destroy();
      }
    };
  }, [channel]);

  return <div ref={chatContainerRef} className="twitch-chat-embed" style={{ width: '100%', height: '500px' }} />;
};

export default TwitchChat;