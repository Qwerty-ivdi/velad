// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from './lib/supabase';
import Navbar from './components/layout/Navbar';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import AuthCallback from './components/auth/AuthCallback';
import ProfilePage from './components/profile/ProfilePage';
import StreamsPage from './components/twitch/StreamsPage';
import TwitchPlayer from './components/twitch/TwitchPlayer';
import YearlyStats from './components/stats/YearlyStats';
import Messenger from './components/messenger/Messenger';
import SearchPage from './components/search/SearchPage';
import socketService from './services/socket';
import './styles/global.css';
import './styles/navbar.css';
import './styles/ProfileHeader.css';

function AppContent() {
  const [user, setUser] = useState(null);
  const [showMessenger, setShowMessenger] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getToken();
      const storedUser = api.getUser();
      
      console.log('🔍 Checking auth, token exists:', !!token);
      
      if (!token || !storedUser) {
        console.log('❌ No token or stored user, redirecting to login');
        setLoading(false);
        return;
      }
      
      try {
        // Пытаемся получить профиль, чтобы проверить валидность токена
        const profile = await api.getProfile(token);
        console.log('✅ Profile loaded:', profile);
        setUser(profile);
        api.setUser(profile);
        
        // Подключаем Socket.IO для авторизованного пользователя
        if (profile.id) {
          socketService.connect(profile.id, token);
        }
      } catch (error) {
        console.error('❌ Token validation failed:', error);
        // Токен невалиден — очищаем всё
        api.removeToken();
        api.removeUser();
        socketService.disconnect();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const handleLogout = () => {
    api.removeToken();
    api.removeUser();
    socketService.disconnect();
    setUser(null);
    navigate('/login');
  };

  const openMessenger = () => {
    setShowMessenger(true);
  };

  const closeMessenger = () => {
    setShowMessenger(false);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        onOpenMessenger={openMessenger}
      />
      
      <div className="main-content">
        <Routes>
          {/* Если пользователь авторизован, отправляем на /streams, иначе на /login */}
          <Route path="/" element={user ? <Navigate to="/streams" /> : <Navigate to="/login" />} />
          <Route path="/login" element={user ? <Navigate to="/streams" /> : <LoginPage setUser={setUser} />} />
          <Route path="/register" element={user ? <Navigate to="/streams" /> : <RegisterPage setUser={setUser} />} />
          <Route path="/auth/callback" element={<AuthCallback setUser={setUser} />} />
          <Route path="/profile" element={user ? <ProfilePage user={user} setUser={setUser} /> : <Navigate to="/login" />} />
          <Route path="/profile/:userId" element={<ProfilePage user={user} setUser={setUser} />} />
          <Route path="/streams" element={<StreamsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/stream/:channel" element={<TwitchPlayer token={api.getToken()} currentUser={user} />} />
          <Route path="/stats" element={user ? <YearlyStats token={api.getToken()} user={user} /> : <Navigate to="/login" />} />
        </Routes>
      </div>
      
      {/* Глобальный мессенджер */}
      {showMessenger && user && (
        <Messenger
          currentUserId={user.id}
          otherUserId={null}
          otherUserName={null}
          otherUserAvatar={null}
          onClose={closeMessenger}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;