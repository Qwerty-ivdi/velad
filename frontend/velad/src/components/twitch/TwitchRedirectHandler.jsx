import React from 'react';
import { FaTwitch } from 'react-icons/fa';
import '../../styles/twitch.css';

const TwitchRedirectHandler = () => {
  return (
    <div className="twitch-redirect">
      <div className="redirect-card">
        <FaTwitch className="twitch-icon animate-pulse" />
        <h2>Перенаправление на Twitch...</h2>
        <p>Пожалуйста, подождите</p>
        <div className="loader"></div>
      </div>
    </div>
  );
};

export default TwitchRedirectHandler;