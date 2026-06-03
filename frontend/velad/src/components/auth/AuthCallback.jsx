// src/components/auth/AuthCallback.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../lib/supabase';

const AuthCallback = ({ setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get('access_token');
    const error = params.get('error');

    console.log('🔍 AuthCallback mounted');
    console.log('🔍 Full URL:', window.location.href);
    console.log('🔍 Access token from URL:', accessToken ? accessToken.substring(0, 50) + '...' : 'null');
    console.log('🔍 Error:', error);

    if (error) {
      console.error('Auth error:', error);
      navigate('/login?error=twitch_auth_failed');
      return;
    }

    if (accessToken) {
      console.log('📝 Saving token to localStorage');
      api.setToken(accessToken);
      
      console.log('📡 Fetching user profile...');
      api.getProfile(accessToken)
        .then(user => {
          console.log('✅ User profile loaded:', user);
          api.setUser(user);
          if (setUser) setUser(user);
          navigate('/profile');
        })
        .catch(err => {
          console.error('❌ Error getting user profile:', err);
          console.error('❌ Error details:', err.message);
          navigate('/login');
        });
    } else {
      console.log('❌ No access token in URL');
      navigate('/login');
    }
  }, [location, navigate, setUser]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-subtitle">Авторизация через Twitch</h2>
        <div className="loading-spinner"></div>
        <p>Перенаправление...</p>
      </div>
    </div>
  );
};

export default AuthCallback;