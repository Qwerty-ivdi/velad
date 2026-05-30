// src/components/twitch/TwitchEmbed.jsx
import React from 'react';
import '../../styles/twitch.css';

const TwitchEmbed = ({ channel, layout = 'video', theme = 'dark' }) => {
  // Встроенный плеер Twitch (не требует API ключа)
  return (
    <div className="twitch-embed">
      <iframe
        src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=false`}
        height="360"
        width="100%"
        allowFullScreen
        title="Twitch Stream"
      />
    </div>
  );
};

export default TwitchEmbed;