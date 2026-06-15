import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/supabase';
import socketService from '../../services/socket';

const AuthCallback = ({ setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get('access_token');
    const error = params.get('error');

    if (error) {
      navigate('/login?error=twitch_auth_failed');
      return;
    }

    if (accessToken) {
      console.log('📝 Saving token from Twitch callback');
      api.setToken(accessToken);
      
      api.getProfile(accessToken)
        .then(user => {
          console.log('✅ User profile loaded:', user);
          api.setUser(user);
          if (setUser) setUser(user);
          
          console.log('🔌 Connecting socket for Twitch user:', user.id);
          socketService.connect(user.id, accessToken);
          
          navigate('/profile');
        })
        .catch(err => {
          console.error('❌ Error getting user profile:', err);
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, [location, navigate, setUser]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Авторизация через Twitch</h2>
        <div className="loading-spinner"></div>
        <p>Перенаправление...</p>
      </div>
    </div>
  );
};

export default AuthCallback;