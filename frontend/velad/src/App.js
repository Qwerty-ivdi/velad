import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'
import ProfilePage from './components/profile/ProfilePage'
import AuthCallback from './components/auth/AuthCallback'
import Navbar from './components/layout/Navbar'
import LoadingSpinner from './components/common/LoadingSpinner'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Проверяем текущую сессию
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Слушаем изменения авторизации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
        <Navbar user={user} />
        <Routes>
          <Route path="/" element={
            user ? <Navigate to="/profile" /> : <Navigate to="/login" />
          } />
          <Route path="/login" element={
            user ? <Navigate to="/profile" /> : <LoginPage />
          } />
          <Route path="/register" element={
            user ? <Navigate to="/profile" /> : <RegisterPage />
          } />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile" element={
            user ? <ProfilePage user={user} /> : <Navigate to="/login" />
          } />
          <Route path="/profile/:userId" element={<ProfilePage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App