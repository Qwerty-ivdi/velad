// src/components/common/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaHome, FaSearch, FaTv, FaChartBar, FaEnvelope, FaUser, FaSignOutAlt, FaTwitch } from 'react-icons/fa';

const Navbar = ({ user, onLogout, onOpenMessenger }) => {  // 👈 ДОБАВЬТЕ onOpenMessenger
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="brand-link">
          <FaTwitch className="brand-icon" />
          <span className="brand-name">Velad</span>
        </Link>
      </div>

      <div className="navbar-links">
        <Link to="/streams" className="nav-link">
          <FaTv /> Стримы
        </Link>
        <Link to="/search" className="nav-link">
          <FaSearch /> Поиск
        </Link>
        {user && (
          <Link to="/stats" className="nav-link">
            <FaChartBar /> Статистика
          </Link>
        )}
      </div>

      <div className="navbar-user">
        {user ? (
          <>
            <button 
              className="nav-icon-btn messenger-btn" 
              onClick={onOpenMessenger}  // 👈 ИСПОЛЬЗУЙТЕ
              title="Сообщения"
            >
              <FaEnvelope />
              <span className="badge">0</span>
            </button>
            <Link to="/profile" className="user-avatar">
              <img 
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=9146FF&color=fff&size=32`} 
                alt={user.display_name}
              />
            </Link>
            <button onClick={onLogout} className="logout-btn" title="Выйти">
              <FaSignOutAlt />
            </button>
          </>
        ) : (
          <button onClick={() => navigate('/login')} className="login-btn">
            Войти
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;