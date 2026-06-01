import React, { useState, useEffect } from 'react';
import { api } from '../../lib/supabase';
import { FaTrophy, FaClock, FaCalendar, FaFire, FaHeart, FaLaugh, FaThumbsUp } from 'react-icons/fa';
import './Stats.css';

const YearlyStats = ({ token }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadStats();
  }, [year]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/stats/yearly?year=${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return <div className="stats-loading">Загрузка вашей статистики...</div>;
  }

  if (!stats) {
    return <div className="stats-error">Не удалось загрузить статистику</div>;
  }

  return (
    <div className="yearly-stats">
      <div className="stats-header">
        <h1>🎯 Ваш год на Velad</h1>
        <p>Итоги {stats.year} года</p>
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
          <div className="stat-icon"><FaCalendar /></div>
          <div className="stat-value">{stats.favorite_day}</div>
          <div className="stat-label">любимый день</div>
        </div>
      </div>

      {/* Топ стримеры */}
      <div className="stats-section">
        <h2>🏆 Ваши любимые стримеры</h2>
        <div className="top-streamers">
          {stats.top_streamers.map((streamer, index) => (
            <div key={streamer.streamer_id} className="streamer-card">
              <div className="streamer-rank">#{index + 1}</div>
              <div className="streamer-info">
                <h3>{streamer.streamer_name}</h3>
                <p>{Math.round(streamer.watch_time_hours)} часов • {streamer.watch_time_minutes} минут</p>
              </div>
              {index === 0 && <div className="crown-badge">👑</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Топ реакции */}
      {stats.top_reactions.length > 0 && (
        <div className="stats-section">
          <h2>✨ Чаще всего вы использовали</h2>
          <div className="top-reactions">
            {stats.top_reactions.map(reaction => (
              <div key={reaction.reaction_type} className="reaction-card">
                <div className="reaction-icon">{getReactionIcon(reaction.reaction_type)}</div>
                <div className="reaction-count">{reaction.total_count}</div>
                <div className="reaction-type">{reaction.reaction_type}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Мотивирующее сообщение */}
      <div className="stats-footer">
        <p>🎉 Спасибо, что вы с нами!</p>
        <p className="next-year">Ждём вас в {stats.year + 1} году с новыми стримами!</p>
      </div>
    </div>
  );
};

export default YearlyStats;