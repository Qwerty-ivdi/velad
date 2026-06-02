import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import '../../styles/twitch.css';
import { FaTwitch, FaGamepad, FaUsers, FaExternalLinkAlt } from 'react-icons/fa';

const ProfileTwitchWidget = ({ twitchLogin, onConnect }) => {
  const [streamInfo, setStreamInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (twitchLogin) {
      loadStreamInfo();
    }
  }, [twitchLogin]);

  const loadStreamInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/twitch/streams/user/${twitchLogin}`);
      const data = await response.json();
      setStreamInfo(data);
    } catch (err) {
      console.error('Error loading stream info:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!twitchLogin) {
    return (
      <div className="profile-twitch-widget">
        <div className="widget-header">
          <FaTwitch /> Twitch
        </div>
        <div className="widget-content">
          <p>Подключите Twitch аккаунт, чтобы показывать статус стрима</p>
          <button onClick={onConnect} className="connect-twitch-btn">
            <FaTwitch /> Подключить Twitch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-twitch-widget">
      <div className="widget-header">
        <FaTwitch /> Twitch
        <a href={`https://twitch.tv/${twitchLogin}`} target="_blank" rel="noopener noreferrer" className="twitch-link">
          @{twitchLogin} <FaExternalLinkAlt />
        </a>
      </div>
      <div className="widget-content">
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : streamInfo?.is_live ? (
          <div className="live-stream-info">
            <div className="live-badge-large">🔴 СТРИМ ИДЁТ</div>
            <h4>{streamInfo.title}</h4>
            <p><FaGamepad /> {streamInfo.game_name}</p>
            <p><FaUsers /> {streamInfo.viewer_count} зрителей</p>
            <div className="stream-preview-small">
              <img 
                src={streamInfo.thumbnail_url?.replace('{width}', '320').replace('{height}', '180')}
                alt=""
              />
            </div>
            <a href={`https://twitch.tv/${twitchLogin}`} target="_blank" rel="noopener noreferrer" className="watch-stream-btn">
              Смотреть стрим
            </a>
          </div>
        ) : (
          <div className="offline-stream-info">
            <p>Сейчас не стримит</p>
            <a href={`https://twitch.tv/${twitchLogin}`} target="_blank" rel="noopener noreferrer" className="twitch-channel-link">
              Перейти на канал
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileTwitchWidget;