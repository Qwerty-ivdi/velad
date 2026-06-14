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
    const token = api.getToken();
    const storedUser = api.getUser();
    
    if (token && storedUser) {
      // Проверяем, что токен всё ещё валиден
      api.getProfile(token).then(profile => {
        setUser(profile);
        api.setUser(profile);
      }).catch(() => {
        // Токен невалиден — очищаем
        api.removeToken();
        api.removeUser();
        setUser(null);
      });
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    api.removeToken();
    api.removeUser();
    socketService.disconnect();
    setUser(null);
  };

  const openMessenger = () => {
    setShowMessenger(true);
  };

  const closeMessenger = () => {
    setShowMessenger(false);
  };

  if (loading) {
    return <div className="loading-screen">Загрузка...</div>;
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
          <Route path="/" element={<Navigate to="/streams" />} />
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          <Route path="/register" element={<RegisterPage setUser={setUser} />} />
          <Route path="/auth/callback" element={<AuthCallback setUser={setUser} />} />
          <Route path="/profile" element={<ProfilePage user={user} setUser={setUser} />} />
          <Route path="/profile/:userId" element={<ProfilePage user={user} setUser={setUser} />} />
          <Route path="/streams" element={<StreamsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/stream/:channel" element={<TwitchPlayer token={api.getToken()} currentUser={user} />} />
          <Route path="/stats" element={<YearlyStats token={api.getToken()} user={user} />} />
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