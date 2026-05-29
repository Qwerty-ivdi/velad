import React, { useState, useEffect } from 'react';
import { api } from '../../lib/supabase';
import { FaTwitch, FaUsers, FaGamepad, FaCalendar } from 'react-icons/fa';

const TwitchStream = ({ stream, compact = false }) => {
  if (!stream) return null;

  const formatDate = (date) => {
    return new Date(date).toLocaleString('ru-RU');
  };

  return (
    <div className={`twitch-stream ${compact ? 'compact' : ''}`}>
      <div className="stream-preview">
        <img 
          src={stream.thumbnail_url?.replace('{width}', '320').replace('{height}', '180')}
          alt={stream.title}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/320x180?text=No+Preview';
          }}
        />
        <span className="live-badge">LIVE</span>
        <span className="viewer-count">
          <FaUsers /> {stream.viewer_count}
        </span>
      </div>
      
      <div className="stream-info">
        <h4>{stream.title}</h4>
        <div className="stream-details">
          <span><FaGamepad /> {stream.game_name}</span>
          <span><FaCalendar /> {formatDate(stream.started_at)}</span>
        </div>
        <a 
          href={`https://twitch.tv/${stream.user_login}`}
          target="_blank"
          rel="noopener noreferrer"
          className="watch-btn"
        >
          <FaTwitch /> Смотреть на Twitch
        </a>
      </div>
    </div>
  );
};

export default TwitchStream;