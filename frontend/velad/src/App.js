import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './lib/supabase'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import ProfilePage from './components/profile/ProfilePage'
import AuthCallback from './components/auth/AuthCallback'
import Navbar from './components/layout/Navbar'
import LoadingSpinner from './components/common/LoadingSpinner'
import SearchPage from './components/search/SearchPage'
import StreamsPage from './components/twitch/StreamsPage';

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Проверяем сохраненного пользователя
    const savedUser = api.getUser()
    const token = api.getToken()
    
    if (savedUser && token) {
      setUser(savedUser)
    }
    setLoading(false)
  }, [])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <Navbar user={user} setUser={setUser} />
        <Routes>       
          <Route path="/" element={
            user ? <Navigate to="/profile" /> : <Navigate to="/login" />
          } />
          <Route path="/login" element={
            user ? <Navigate to="/profile" /> : <LoginPage setUser={setUser} />
          } />
          <Route path="/register" element={
            user ? <Navigate to="/profile" /> : <RegisterPage setUser={setUser} />
          } />
          <Route path="/auth/callback" element={<AuthCallback setUser={setUser} />} />
          <Route path="/profile" element={
            user ? <ProfilePage user={user} setUser={setUser} /> : <Navigate to="/login" />
          } />
          <Route path="/profile/:userId" element={<ProfilePage user={user} />} />
          <Route path="/search" element={
            user ? <SearchPage token={api.getToken()} /> : <Navigate to="/login" />
          } />
          <Route path="/streams" element={<StreamsPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App