// src/components/users/UserListItem.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/supabase';

const UserListItem = ({ user, token, currentUserId, onFollowChange }) => {
  const [isFollowing, setIsFollowing] = useState(user.is_following || false);
  const [followersCount, setFollowersCount] = useState(user.followers_count || 0);

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await api.unfollowUser(token, user.id);
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        if (onFollowChange) onFollowChange(user.id, false);
      } else {
        await api.followUser(token, user.id);
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        if (onFollowChange) onFollowChange(user.id, true);
      }
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  if (currentUserId === user.id) {
    return (
      <div className="user-list-item">
        <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=9146FF&color=fff&size=48`} alt="" className="user-list-avatar" />
        <div className="user-list-info">
          <h4>{user.display_name}</h4>
          <p>@{user.username}</p>
          <span>📊 {followersCount} подписчиков</span>
        </div>
        <span className="self-badge">Это вы</span>
      </div>
    );
  }

  return (
    <div className="user-list-item">
      <Link to={`/profile/${user.id}`} className="user-list-avatar">
        <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.display_name}&background=9146FF&color=fff&size=48`} alt="" />
      </Link>
      <div className="user-list-info">
        <Link to={`/profile/${user.id}`}><h4>{user.display_name}</h4></Link>
        <p>@{user.username}</p>
        <span>📊 {followersCount} подписчиков</span>
      </div>
      <button className={`follow-btn ${isFollowing ? 'following' : ''}`} onClick={handleFollow}>
        {isFollowing ? 'Отписаться' : 'Подписаться'}
      </button>
    </div>
  );
};

export default UserListItem;