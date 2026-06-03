// src/components/stats/YearlyStats.jsx
import React, { useState, useEffect } from 'react';
import { api, twitchAuth } from '../../lib/supabase';
import { API_URL } from '../../config';
import { FaTwitch, FaTrophy, FaClock, FaFire, FaHeart, FaLaugh, FaThumbsUp, FaComment } from 'react-icons/fa';
import './Stats.css';

const YearlyStats = ({ token, user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTwitchConnected, setIsTwitchConnected] = useState(false);  // ← ДОБАВЬ ЭТО!
  const [year] = useState(new Date().getFullYear());

  // Проверяем, связан ли Twitch аккаунт
  useEffect(() => {
    const checkTwitchStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/twitch-status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setIsTwitchConnected(data.connected);
      } catch (err) {
        console.error('Error checking Twitch status:', err);
      }
    };
    
    checkTwitchStatus();
  }, [token]);

  useEffect(() => {
    if (isTwitchConnected) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [year, isTwitchConnected]);

const loadStats = async () => {
  setLoading(true);
  setError(null);
  try {
    const response = await fetch(`${API_URL}/yearly`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    console.log('Stats response:', data);  // Добавь лог
    
    if (response.ok) {
      setStats(data);
    } else {
      setError(data.error || 'Failed to load stats');
    }
  } catch (err) {
    console.error('Error loading stats:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  const handleConnectTwitch = () => {
    twitchAuth.login();
  };

  const getReactionIcon = (type) => {
    const icons = {
      '❤️': <FaHeart style={{ color: '#ef4444' }} />,
      '😂': <FaLaugh style={{ color: '#f59e0b' }} />,
      '🔥': <FaFire style={{ color: '#f97316' }} />,
      '👏': <FaThumbsUp style={{ color: '#10b981' }} />
    };
    return icons[type] || <FaHeart />;
  };

  // Если загрузка
  if (loading) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <h1>🎯 Статистика</h1>
          <div className="loading-spinner"></div>
          <p>Загрузка вашей статистики...</p>
        </div>
      </div>
    );
  }

  // Если пользователь не подключил Twitch
  if (!loading && !isTwitchConnected) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <h1>🎯 Статистика</h1>
          <p>Подключите Twitch, чтобы видеть статистику</p>
        </div>
        <div className="stats-empty">
          <FaTwitch className="empty-icon" />
          <h3>Подключите ваш Twitch аккаунт</h3>
          <p>Чтобы собирать статистику просмотров и сообщений в чате</p>
          <button onClick={handleConnectTwitch} className="btn-twitch-connect">
            <FaTwitch /> Подключить Twitch
          </button>
        </div>
      </div>
    );
  }

  // Если нет данных
  if (stats && stats.total_stats.total_seconds === 0) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <h1>🎯 Статистика</h1>
          <p>У вас пока нет статистики</p>
        </div>
        <div className="stats-empty">
          <FaTwitch className="empty-icon" />
          <h3>Смотрите стримы, чтобы собрать статистику!</h3>
          <p>Ваши просмотры и сообщения будут отображаться здесь</p>
          <button onClick={() => window.location.href = '/streams'} className="btn-primary">
            Найти стримы
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-container">
        <div className="stats-header">
          <h1>🎯 Статистика</h1>
          <div className="stats-error">
            <p>Ошибка загрузки статистики: {error}</p>
            <button onClick={loadStats} className="retry-btn">Повторить</button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="yearly-stats">
      <div className="stats-header">
        <h1>🎯 Ваша Статистика</h1>
      </div>

      {/* Общая статистика */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon"><FaClock /></div>
          <div className="stat-value">{stats.total_stats.total_hours}</div>
          <div className="stat-label">часов просмотра</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaTrophy /></div>
          <div className="stat-value">{stats.total_stats.unique_streamers}</div>
          <div className="stat-label">стримеров</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaComment /></div>
          <div className="stat-value">{stats.message_stats.total_messages}</div>
          <div className="stat-label">сообщений в чате</div>
        </div>
      </div>

      {/* Топ стримеры по просмотрам */}
      {stats.top_streamers.length > 0 && (
        <div className="stats-section">
          <h2>🏆 Ваши любимые стримеры</h2>
          <div className="top-streamers">
            {stats.top_streamers.map((streamer, index) => (
              <div key={streamer.streamer_id} className="streamer-card">
                <div className="streamer-rank">#{index + 1}</div>
                <div className="streamer-info">
                  <h3>{streamer.streamer_name}</h3>
                  <p>{Math.round(streamer.watch_hours)} часов • {streamer.watch_minutes} минут</p>
                </div>
                {index === 0 && <div className="crown-badge">👑</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Топ стримеры по сообщениям */}
      {stats.top_chatters.length > 0 && (
        <div className="stats-section">
          <h2>💬 Чаще всего писали в чате</h2>
          <div className="top-streamers">
            {stats.top_chatters.map((streamer, index) => (
              <div key={streamer.streamer_id} className="streamer-card">
                <div className="streamer-rank">#{index + 1}</div>
                <div className="streamer-info">
                  <h3>{streamer.streamer_name}</h3>
                  <p>{streamer.message_count} сообщений</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default YearlyStats;