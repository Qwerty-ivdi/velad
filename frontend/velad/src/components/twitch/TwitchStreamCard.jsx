import React, { useState } from 'react';
import { FaTwitch, FaUsers, FaGamepad, FaCalendar, FaHeart, FaComment, FaShare } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import '../../styles/twitch.css';

const TwitchStreamCard = ({ stream, compact = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  const formatViewers = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (!stream) return null;

  if (compact) {
    return (
      <div className="twitch-stream-card compact">
        <div className="stream-preview">
          <img 
            src={stream.thumbnail_url?.replace('{width}', '320').replace('{height}', '180') || 'https://via.placeholder.com/320x180?text=No+Preview'}
            alt={stream.title}
          />
          <span className="live-badge">LIVE</span>
          <span className="viewer-count">
            <FaUsers /> {formatViewers(stream.viewer_count)}
          </span>
          <div className="stream-overlay">
            <a 
              href={`https://twitch.tv/${stream.user_login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="watch-btn"
            >
              <FaTwitch /> Смотреть
            </a>
          </div>
        </div>
        <div className="stream-info">
          <Link to={`/profile/${stream.user_id}`}>
            <img 
              src={stream.profile_image_url || `https://ui-avatars.com/api/?name=${stream.user_name}&background=9146FF&color=fff&size=40`}
              alt=""
              className="streamer-avatar"
            />
          </Link>
          <div className="stream-details">
            <h4>{stream.title?.substring(0, 60)}</h4>
            <p className="streamer-name">{stream.user_name}</p>
            <p className="game-name"><FaGamepad /> {stream.game_name}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="twitch-stream-card" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className="stream-preview">
        <img 
          src={stream.thumbnail_url?.replace('{width}', '640').replace('{height}', '360') || 'https://via.placeholder.com/640x360?text=No+Preview'}
          alt={stream.title}
        />
        <span className="live-badge">🔴 LIVE</span>
        <span className="viewer-count">
          <FaUsers /> {formatViewers(stream.viewer_count)} зрителей
        </span>
        {isHovered && (
          <div className="stream-overlay">
            <a 
              href={`https://twitch.tv/${stream.user_login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="watch-btn"
            >
              <FaTwitch /> Смотреть на Twitch
            </a>
          </div>
        )}
      </div>
      
      <div className="stream-info">
        <Link to={`/profile/${stream.user_id}`}>
          <img 
            src={stream.profile_image_url || `https://ui-avatars.com/api/?name=${stream.user_name}&background=9146FF&color=fff&size=56`}
            alt=""
            className="streamer-avatar"
          />
        </Link>
        <div className="stream-details">
          <h3>{stream.title}</h3>
          <div className="stream-meta">
            <span className="streamer-name">
              <Link to={`/profile/${stream.user_id}`}>{stream.user_name}</Link>
            </span>
            <span className="game-name"><FaGamepad /> {stream.game_name}</span>
            <span className="started-at"><FaCalendar /> {formatDate(stream.started_at)}</span>
          </div>
        </div>
      </div>
      
      <div className="stream-actions">
        <button className="stream-action-btn">
          <FaHeart /> <span>Подписаться</span>
        </button>
        <button className="stream-action-btn">
          <FaComment /> <span>Чат</span>
        </button>
        <button className="stream-action-btn">
          <FaShare /> <span>Поделиться</span>
        </button>
      </div>
    </div>
  );
};

export default TwitchStreamCard;