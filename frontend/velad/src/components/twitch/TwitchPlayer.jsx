// src/components/twitch/TwitchPlayer.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/supabase';
import { useWatchSession } from '../../hooks/useWatchSession';
import { FaTwitch, FaClock, FaComment, FaHeart, FaArrowLeft } from 'react-icons/fa';
import tmi from 'tmi.js';
import { API_URL } from '../../config';
import '../../styles/TwitchPlayer.css';

const TwitchPlayer = ({ token, currentUser }) => {
  const { channel } = useParams();
  const navigate = useNavigate();
  const [streamInfo, setStreamInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [watchTime, setWatchTime] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [hasTwitchAuth, setHasTwitchAuth] = useState(false);
  const [twitchUsername, setTwitchUsername] = useState(null);
  const [twitchAccessToken, setTwitchAccessToken] = useState(null);
  
  const startTimeRef = useRef(null);
  const heartbeatInterval = useRef(null);
  const chatClientRef = useRef(null);
  const messagesEndRef = useRef(null);
  const processedMessageIds = useRef(new Set());
  const isInitializedRef = useRef(false);
  
  const sessionId = useWatchSession(channel, token);
  const user = currentUser || api.getUser();

  // ==================== ПОЛУЧЕНИЕ ТОКЕНА TWITCH ====================
  const getTwitchToken = useCallback(async () => {
    try {
      console.log('📡 Requesting Twitch token from backend...');
      
      const response = await fetch(`${API_URL}/twitch-token`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('📡 Response:', data);
      
      if (data.has_token && data.twitch_access_token) {
        setHasTwitchAuth(true);
        setTwitchUsername(data.twitch_login); 
        setTwitchAccessToken(data.twitch_access_token);
        return data.twitch_access_token;
      } else {
        console.log('⚠️ No Twitch token available');
        return null;
      }
    } catch (err) {
      console.error('❌ Error getting Twitch token:', err);
      return null;
    }
  }, [token]);

  // ==================== ПОДКЛЮЧЕНИЕ К ЧАТУ ====================
  useEffect(() => {
    if (!channel || isInitializedRef.current) return;

    let client = null;
    let isMounted = true;
    let isConnected = false;

    const initChat = async () => {
      if (chatClientRef.current) {
        console.log('⚠️ Chat client already exists, skipping...');
        return;
      }

      try {
        const twitchToken = await getTwitchToken();
        
        console.log('🔧 Initializing chat for channel:', channel);
        console.log('🔧 Has token:', !!twitchToken);
        console.log('🔧 Username:', twitchUsername);
        
        const clientConfig = {
          options: { debug: false },
          connection: {
            reconnect: true,
            secure: true
          },
          channels: [channel]
        };
        
        if (twitchToken && twitchUsername) {
          clientConfig.identity = {
            username: twitchUsername.toLowerCase(),
            password: `oauth:${twitchToken}`
          };
          console.log(`🔐 Connecting to chat as ${twitchUsername} with token length: ${twitchToken.length}`);
        } else {
          console.log('👁️ No Twitch token, connecting in read-only mode');
        }
        
        client = new tmi.Client(clientConfig);
        chatClientRef.current = client;

        client.on('connected', () => {
          if (!isMounted) return;
          if (!isConnected) {
            isConnected = true;
            console.log(`✅ Connected to ${channel} chat as ${twitchUsername || 'anonymous'}`);
            setChatConnected(true);
          }
        });

        client.on('message', (target, context, msg, self) => {
          if (self) return;
          
          const username = context['display-name'] || context.username;
          const messageText = msg.trim();
          const twitchMessageId = context.id;
          
          if (processedMessageIds.current.has(twitchMessageId)) {
            console.log('🔄 Duplicate message skipped:', twitchMessageId);
            return;
          }
          
          processedMessageIds.current.add(twitchMessageId);
          
          setTimeout(() => {
            processedMessageIds.current.delete(twitchMessageId);
          }, 5000);
          
          const messageId = `${channel}-${twitchMessageId}`;
          
          setChatMessages(prev => {
            const exists = prev.some(m => m.id === messageId);
            if (exists) return prev;
            
            return [...prev, {
              id: messageId,
              user: username,
              message: messageText,
              isOwn: false,
              timestamp: new Date(),
              messageId: twitchMessageId
            }];
          });
          
          scrollToBottom();
        });

        client.on('disconnected', (reason) => {
          if (!isMounted) return;
          console.log(`🔌 Disconnected from ${channel} chat: ${reason}`);
          setChatConnected(false);
          isConnected = false;
        });

        await client.connect();
        isInitializedRef.current = true;
        
      } catch (err) {
        console.error('❌ Error connecting to chat:', err);
        if (isMounted) setChatConnected(false);
      }
    };

    initChat();

    return () => {
      isMounted = false;
      isInitializedRef.current = false;
      processedMessageIds.current.clear();
      if (chatClientRef.current) {
        console.log('🧹 Cleaning up chat client...');
        const clientToClose = chatClientRef.current;
        chatClientRef.current = null;
        try {
          clientToClose.removeAllListeners();
          clientToClose.disconnect();
        } catch (err) {
          console.log('Disconnect error (ignored):', err.message);
        }
      }
    };
  }, [channel, token, twitchUsername, getTwitchToken]);

  // ==================== ОТПРАВКА СООБЩЕНИЯ ====================
  const sendChatMessage = async (e) => {
    e.preventDefault();
    const messageText = newMessage.trim();
    
    if (!messageText) return;
    
    if (!chatClientRef.current || !chatConnected) {
      alert('Чат не подключен. Попробуйте позже.');
      return;
    }
    
    if (!hasTwitchAuth || !twitchAccessToken) {
      alert('Для отправки сообщений необходимо войти через Twitch.\n\nНажмите на иконку профиля → Настройки → Подключить Twitch');
      return;
    }
    
    setNewMessage('');
    
    const tempMessageId = `temp-${Date.now()}-${Math.random()}`;
    const tempMessage = {
      id: tempMessageId,
      user: twitchUsername || user?.display_name || 'Вы',
      message: messageText,
      isOwn: true,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, tempMessage]);
    scrollToBottom();
    
    try {
      await chatClientRef.current.say(`#${channel}`, messageText);
      console.log('✅ Message sent to chat:', messageText);
      
      try {
        await fetch(`${API_URL}/track/message`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            streamer_name: channel
          })
        });
      } catch (statsErr) {
        console.warn('Stats tracking error:', statsErr);
      }
      
    } catch (err) {
      console.error('❌ Error sending message:', err);
      alert('Не удалось отправить сообщение. Проверьте подключение к чату.');
      setChatMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
      setNewMessage(messageText);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`${API_URL}/track/view/heartbeat`, { 
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ session_id: sessionId, duration: 30 })
      });
    } catch (err) { 
      console.warn('Heartbeat error:', err); 
    }
  }, [sessionId, token]);

  useEffect(() => {
    if (sessionId) {
      heartbeatInterval.current = setInterval(sendHeartbeat, 30000);
      return () => { 
        if (heartbeatInterval.current) clearInterval(heartbeatInterval.current); 
      };
    }
  }, [sessionId, sendHeartbeat]);

  useEffect(() => {
    if (!sessionId) return;
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      if (startTimeRef.current) setWatchTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionId]);

  const loadStreamInfo = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/twitch/streams/user/${channel}`);
      const data = await response.json();
      setStreamInfo(data);
    } catch (err) { 
      console.error('Error loading stream info:', err); 
    } finally { 
      setLoading(false); 
    }
  }, [channel]);

  useEffect(() => {
    if (!token) { 
      setLoading(false); 
      return; 
    }
    loadStreamInfo();
  }, [channel, token, loadStreamInfo]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}ч ${minutes}м`;
    if (minutes > 0) return `${minutes}м ${secs}с`;
    return `${secs}с`;
  };

  if (loading) {
    return (
      <div className="twitch-player-loading">
        <div className="loading-spinner"></div>
        <p>Загрузка стрима...</p>
      </div>
    );
  }

  if (!streamInfo?.is_live) {
    return (
      <div className="twitch-player-offline">
        <FaTwitch className="offline-icon" />
        <h2>Стример {channel} сейчас не в эфире</h2>
        <div className="offline-buttons">
          <button onClick={() => navigate('/streams')} className="back-btn">← Назад к стримам</button>
          <a href={`https://twitch.tv/${channel}`} target="_blank" rel="noopener noreferrer" className="twitch-link-btn">
            <FaTwitch /> Открыть канал на Twitch
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="twitch-player-container">
      <div className="player-header">
        <button onClick={() => navigate('/streams')} className="back-btn">
          <FaArrowLeft /> Назад
        </button>
        <div className="stream-info">
          <img 
            src={streamInfo.stream?.profile_image_url || `https://ui-avatars.com/api/?name=${channel}&background=9146FF&color=fff`} 
            alt={channel} 
            className="streamer-avatar-small" 
          />
          <div>
            <h2>{streamInfo.stream?.display_name || channel}</h2>
            <p className="game-name">{streamInfo.stream?.game_name || 'Игра не указана'}</p>
          </div>
        </div>
        <div className="watch-stats">
          <FaClock /> {formatTime(watchTime)}
        </div>
      </div>

      <div className="player-main">
        <div className="player-wrapper">
          <iframe 
            src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=true`} 
            className="twitch-iframe" 
            allowFullScreen 
            title={`${channel} stream`} 
          />
        </div>

        <div className="chat-wrapper">
          <div className="chat-header">
            <FaComment /> Чат {chatConnected ? '🟢' : '🔴'}
            {!hasTwitchAuth && (
              <span className="chat-warning"> 
                (войдите через Twitch чтобы писать)
              </span>
            )}
          </div>
          
          <div className="chat-messages">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.isOwn ? 'own-message' : ''}`}>
                <strong>{msg.user}:</strong> <span>{msg.message}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={sendChatMessage} className="chat-input-form">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={hasTwitchAuth ? "Написать в чат..." : "Войдите через Twitch в настройках, чтобы писать в чат"}
              disabled={!chatConnected || !hasTwitchAuth}
              maxLength="500"
            />
            <button type="submit" disabled={!chatConnected || !hasTwitchAuth || !newMessage.trim()}>
              Отправить
            </button>
          </form>
        </div>
      </div>

      <div className="player-footer">
        <div className="stream-title">
          <h3>{streamInfo.stream?.title}</h3>
        </div>
        <div className="stream-actions">
          <button className="action-btn" onClick={() => setIsSubscribed(!isSubscribed)}>
            <FaHeart /> {isSubscribed ? 'Подписан' : 'Подписаться'}
          </button>
          <a href={`https://twitch.tv/${channel}`} target="_blank" rel="noopener noreferrer" className="action-btn">
            <FaTwitch /> Открыть на Twitch
          </a>
        </div>
      </div>
    </div>
  );
};

export default TwitchPlayer;