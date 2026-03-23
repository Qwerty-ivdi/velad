import React from 'react'
import { Link } from 'react-router-dom'
import { FaUserPlus, FaUserCheck } from 'react-icons/fa'

const UserList = ({ users, title, onFollow, currentUserId }) => {
  if (!users || users.length === 0) {
    return (
      <div className="empty-list">
        <p>Нет пользователей для отображения</p>
      </div>
    )
  }

  return (
    <div className="user-list">
      <h3>{title}</h3>
      {users.map(user => (
        <div key={user.id} className="user-list-item">
          <Link to={`/profile/${user.id}`} className="user-list-avatar">
            <img 
              src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=9146FF&color=fff&size=48`}
              alt={user.display_name}
            />
          </Link>
          <div className="user-list-info">
            <Link to={`/profile/${user.id}`}>
              <h4>{user.display_name}</h4>
            </Link>
            <p className="username">@{user.username}</p>
            {user.bio && <p className="bio">{user.bio.substring(0, 80)}</p>}
            <span className="followers-count">📊 {user.followers_count || 0} подписчиков</span>
          </div>
          {currentUserId !== user.id && (
            <button 
              className={`follow-btn ${user.is_following ? 'following' : ''}`}
              onClick={() => onFollow(user.id, user.is_following)}
            >
              {user.is_following ? <FaUserCheck /> : <FaUserPlus />}
              {user.is_following ? 'Подписан' : 'Подписаться'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default UserList