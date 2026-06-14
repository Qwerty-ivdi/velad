// src/components/common/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaTv, FaChartBar, FaEnvelope, FaSignOutAlt, FaTwitch, FaUserPlus, FaBars, FaTimes } from 'react-icons/fa';

const Navbar = ({ user, onLogout, onOpenMessenger }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Закрываем меню при смене страницы
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <div className="navbar-brand">
            <Link to="/" className="brand-link">
              <FaTwitch className="brand-icon" />
              <span className="brand-name">Velad</span>
            </Link>
          </div>

          {/* Десктопная навигация (показывается на экранах > 768px) */}
          <div className="navbar-links desktop-only">
            <Link to="/streams" className={`nav-link ${isActive('/streams') ? 'active' : ''}`}>
              <FaTv />
              <span>Стримы</span>
            </Link>
            <Link to="/search" className={`nav-link ${isActive('/search') ? 'active' : ''}`}>
              <FaSearch />
              <span>Поиск</span>
            </Link>
            {user && (
              <Link to="/stats" className={`nav-link ${isActive('/stats') ? 'active' : ''}`}>
                <FaChartBar />
                <span>Статистика</span>
              </Link>
            )}
          </div>

          {/* Десктопный пользовательский блок */}
          <div className="navbar-user desktop-only">
            {user ? (
              <>
                <button 
                  className="nav-icon-btn messenger-btn" 
                  onClick={onOpenMessenger}
                  title="Сообщения"
                >
                  <FaEnvelope />
                </button>
                <div className="user-menu">
                  <Link to="/profile" className="user-avatar">
                    <img 
                      src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=9146FF&color=fff&size=32`} 
                      alt={user.display_name}
                    />
                    <span className="user-name">{user.display_name}</span>
                  </Link>
                </div>
                <button onClick={onLogout} className="logout-btn" title="Выйти">
                  <FaSignOutAlt />
                </button>
              </>
            ) : (
              <div className="auth-buttons">
                <button onClick={() => navigate('/login')} className="login-btn">
                  Войти
                </button>
                <button onClick={() => navigate('/register')} className="register-btn">
                  <FaUserPlus />
                  <span>Регистрация</span>
                </button>
              </div>
            )}
          </div>

          {/* Кнопка бургер-меню (только на мобильных) */}
          <button className="mobile-menu-btn mobile-only" onClick={toggleMobileMenu}>
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </nav>

      {/* Мобильное меню (выезжающее) */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-content">
          {/* Навигационные ссылки */}
          <div className="mobile-nav-links">
            <Link to="/streams" className="mobile-nav-link" onClick={closeMobileMenu}>
              <FaTv />
              <span>Стримы</span>
            </Link>
            <Link to="/search" className="mobile-nav-link" onClick={closeMobileMenu}>
              <FaSearch />
              <span>Поиск</span>
            </Link>
            {user && (
              <Link to="/stats" className="mobile-nav-link" onClick={closeMobileMenu}>
                <FaChartBar />
                <span>Статистика</span>
              </Link>
            )}
          </div>

          {/* Разделитель */}
          <div className="mobile-menu-divider"></div>

          {/* Пользовательский блок для мобильных */}
          {user ? (
            <>
              <button 
                className="mobile-messenger-btn"
                onClick={() => {
                  onOpenMessenger();
                  closeMobileMenu();
                }}
              >
                <FaEnvelope />
                <span>Сообщения</span>
              </button>
              <Link to="/profile" className="mobile-profile-link" onClick={closeMobileMenu}>
                <img 
                  src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=9146FF&color=fff&size=40`} 
                  alt={user.display_name}
                />
                <div className="mobile-profile-info">
                  <span className="mobile-profile-name">{user.display_name}</span>
                  <span className="mobile-profile-username">@{user.username}</span>
                </div>
              </Link>
              <button onClick={() => {
                onLogout();
                closeMobileMenu();
              }} className="mobile-logout-btn">
                <FaSignOutAlt />
                <span>Выйти</span>
              </button>
            </>
          ) : (
            <div className="mobile-auth-buttons">
              <button onClick={() => {
                navigate('/login');
                closeMobileMenu();
              }} className="mobile-login-btn">
                Войти
              </button>
              <button onClick={() => {
                navigate('/register');
                closeMobileMenu();
              }} className="mobile-register-btn">
                <FaUserPlus />
                <span>Регистрация</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Затемнение фона при открытом меню */}
      {mobileMenuOpen && <div className="mobile-menu-overlay" onClick={closeMobileMenu}></div>}
    </>
  );
};

export default Navbar;