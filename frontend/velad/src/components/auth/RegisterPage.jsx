import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, twitchAuth } from '../../lib/supabase';
import { FaTwitch, FaUser, FaEnvelope, FaLock } from 'react-icons/fa';
import '../../styles/auth.css';
import socketService from '../../services/socket';

const RegisterPage = ({ setUser }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleEmailRegister = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  if (formData.password !== formData.confirmPassword) {
    setError('Пароли не совпадают');
    setLoading(false);
    return;
  }

  if (formData.password.length < 6) {
    setError('Пароль должен быть не менее 6 символов');
    setLoading(false);
    return;
  }

  try {
    console.log('📝 Registering with data:', {
      email: formData.email,
      username: formData.username,
      display_name: formData.displayName
    });

    // Регистрация
    const registerResult = await api.register({
      email: formData.email,
      password: formData.password,
      username: formData.username,
      display_name: formData.displayName
    });
    
    console.log('✅ Registration successful:', registerResult);

    // Автоматический вход после регистрации
    const loginResult = await api.login({
      email: formData.email,
      password: formData.password
    });

    console.log('✅ Login successful:', loginResult);

    api.setToken(loginResult.access_token);
    api.setUser(loginResult.user);
    setUser(loginResult.user);
    navigate('/profile');
    
  } catch (err) {
    console.error('❌ Registration error DETAILS:', err);
    console.error('❌ Error message:', err.message);
    console.error('❌ Full error object:', JSON.stringify(err, null, 2));
    
    // Показываем более подробную ошибку
    setError(err.message || 'Ошибка регистрации. Проверьте консоль.');
  } finally {
    setLoading(false);
  }
};

  const handleTwitchRegister = () => {
    setLoading(true);
    twitchAuth.register();
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Velad</h1>
        <h2 className="auth-subtitle">Создать аккаунт</h2>
        
        <div className="auth-link">
          Или <Link to="/login">войдите в существующий</Link>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleEmailRegister}>
          <div className="form-group">
            <div className="input-with-icon">
              <FaUser className="input-icon" />
              <input
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="form-input"
                placeholder="Имя пользователя"
              />
            </div>
          </div>

          <div className="form-group">
            <input
              name="displayName"
              type="text"
              required
              value={formData.displayName}
              onChange={handleChange}
              className="form-input"
              placeholder="Отображаемое имя"
            />
          </div>

          <div className="form-group">
            <div className="input-with-icon">
              <FaEnvelope className="input-icon" />
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                placeholder="Email"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-with-icon">
              <FaLock className="input-icon" />
              <input
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                placeholder="Пароль"
              />
            </div>
          </div>

          <div className="form-group">
            <input
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="form-input"
              placeholder="Подтвердите пароль"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="divider"><span>Или продолжить с</span></div>

        <button
          onClick={handleTwitchRegister}
          disabled={loading}
          className="btn btn-twitch"
        >
          <FaTwitch /> Зарегистрироваться через Twitch
        </button>

        <p className="terms-text">
          Регистрируясь, вы соглашаетесь с нашими{' '}
          <a href="/terms">Условиями использования</a>{' '}
          и{' '}
          <a href="/privacy">Политикой конфиденциальности</a>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;