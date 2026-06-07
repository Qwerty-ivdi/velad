// src/components/profile/ProfileHeader.jsx
import React, { useEffect } from 'react';
import { FaTwitch, FaCalendar, FaMapMarkerAlt, FaLink } from 'react-icons/fa';

const ProfileHeader = ({ 
  profile, 
  isOwnProfile, 
  isFollowing, 
  followersCount, 
  followingCount, 
  onFollow, 
  onEdit 
}) => {
  const formatDate = ({date, onOpenMessenger}) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="profile-header">
      <div className="profile-banner"></div>
      
      <div className="profile-avatar-wrapper">
        <img
          src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.display_name}&background=9146FF&color=fff&size=120`}
          alt={profile.display_name}
          className="profile-avatar"
        />
      </div>
      
      <div className="profile-info">
        <h1 className="profile-name">{profile.display_name}</h1>
        <p className="profile-username">@{profile.username}</p>
        
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        
        <div className="profile-stats">
          <div className="stat-item">
            <div className="stat-value">{followersCount}</div>
            <div className="stat-label">подписчиков</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{followingCount}</div>
            <div className="stat-label">подписок</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{profile.posts_count || 0}</div>
            <div className="stat-label">постов</div>
          </div>
        </div>
        
        <div className="profile-meta">
          {profile.twitch_login && (
            <a 
              href={`https://twitch.tv/${profile.twitch_login}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="profile-meta-item"
            >
              <FaTwitch /> {profile.twitch_login}
            </a>
          )}
          {profile.location && (
            <span className="profile-meta-item">
              <FaMapMarkerAlt /> {profile.location}
            </span>
          )}
          {profile.website && (
            <a 
              href={profile.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="profile-meta-item"
            >
              <FaLink /> {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {profile.created_at && (
            <span className="profile-meta-item">
              <FaCalendar /> Присоединился {formatDate(profile.created_at)}
            </span>
          )}
        </div>
        
        <div className="profile-actions">
          {isOwnProfile ? (
            <button onClick={onEdit} className="btn-edit">
              Редактировать профиль
            </button>
          ) : (
            <>
               <button 
                  onClick={onFollow}
                  className={`btn-follow ${isFollowing ? 'following' : ''}`}
                >
                  {isFollowing ? 'Отписаться' : 'Подписаться'}
                </button>
              <button className="btn-message" onClick={onOpenMessenger}>Написать</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;