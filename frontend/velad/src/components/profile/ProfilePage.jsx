// src/components/profile/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/supabase';
import Post from '../posts/Post';
import CreatePost from '../posts/CreatePost';
import Messenger from '../messenger/Messenger';
import UserListItem from '../users/UserListItem';
import LoadingSpinner from '../common/LoadingSpinner';
import ProfileHeader from './ProfileHeader';
import { FaEdit, FaEnvelope } from 'react-icons/fa';
import cache from '../../lib/cache';
import '../../styles/ProfileHeader.css';
import '../../styles/global.css';

const ProfilePage = ({ user: currentUser, setUser }) => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reposts, setReposts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showMessenger, setShowMessenger] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    location: '',
    website: ''
  });

  const profileId = userId || currentUser?.id;
  const isOwnProfile = currentUser && profileId === currentUser.id;

  // ========== ОБРАБОТЧИКИ ПОСТОВ ==========
  const handlePostUpdate = (updatedPost) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
    cache.invalidateProfile(profileId);
  };

  const handlePostDelete = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    cache.invalidateProfile(profileId);
  };

  const handleLikeUpdate = (postId, isLiked, newLikesCount) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, is_liked: isLiked, likes_count: newLikesCount }
        : post
    ));
  };

  const handlePostCreated = (newPost) => {
    const completePost = {
      ...newPost,
      username: profile?.username,
      display_name: profile?.display_name,
      avatar_url: profile?.avatar_url,
      likes_count: 0,
      comments_count: 0,
      is_liked: false
    };
    setPosts([completePost, ...posts]);
    cache.invalidateProfile(profileId);
  };

  // ========== ЗАГРУЗКА РЕПОСТОВ ==========
  const loadReposts = async () => {
    try {
      const token = api.getToken();
      const data = await api.getUserReposts(profileId, token);
      setReposts(data);
    } catch (err) {
      console.error('Error loading reposts:', err);
    }
  };

  // Объединение постов и репостов
  const allPosts = [...posts, ...reposts].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  // ========== ЗАГРУЗКА ПРОФИЛЯ ==========
  const loadProfile = async () => {
    try {
      setLoading(true);
      const cachedProfile = cache.getProfile(profileId);
      if (cachedProfile) {
        console.log('📦 Using cached profile');
        setProfile(cachedProfile);
        setLoading(false);
        fetchProfileInBackground();
        return;
      }
      await fetchProfileInBackground();
    } catch (err) {
      console.error('Error loading profile:', err);
      setLoading(false);
    }
  };

  const fetchProfileInBackground = async () => {
    try {
      const token = api.getToken();
      let profileData;
      
      if (isOwnProfile) {
        profileData = await api.getProfile(token);
      } else {
        profileData = await api.getUserById(profileId);
      }
      
      console.log('📊 Profile loaded:', {
        id: profileData.id,
        display_name: profileData.display_name,
        is_following: profileData.is_following,
        followers_count: profileData.followers_count
      });
      
      setProfile(profileData);
      cache.setProfile(profileId, profileData);
      setEditForm({
        display_name: profileData.display_name || '',
        bio: profileData.bio || '',
        location: profileData.location || '',
        website: profileData.website || ''
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  // ========== ЗАГРУЗКА ПОСТОВ ==========
  const loadPosts = async () => {
    try {
      const cachedPosts = cache.getPosts(profileId);
      if (cachedPosts) {
        console.log('📦 Using cached posts');
        setPosts(cachedPosts);
        fetchPostsInBackground();
        return;
      }
      await fetchPostsInBackground();
    } catch (err) {
      console.error('Error loading posts:', err);
    }
  };

  const fetchPostsInBackground = async () => {
    try {
      const token = api.getToken();
      const postsData = await api.getUserPosts(profileId, token);
      setPosts(postsData);
      cache.setPosts(profileId, postsData);
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  // ========== ПОДПИСЧИКИ И ПОДПИСКИ ==========
  const loadFollowers = async () => {
    if (!profile?.id) return;
    setLoadingFollowers(true);
    try {
      const token = api.getToken();
      const data = await api.getFollowers(token, profile.id);
      setFollowers(data);
    } catch (err) {
      console.error('Error loading followers:', err);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const loadFollowing = async () => {
    if (!profile?.id) return;
    setLoadingFollowers(true);
    try {
      const token = api.getToken();
      const data = await api.getFollowing(token, profile.id);
      setFollowing(data);
    } catch (err) {
      console.error('Error loading following:', err);
    } finally {
      setLoadingFollowers(false);
    }
  };

  // ========== ОБНОВЛЕНИЕ ПРОФИЛЯ ==========
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = api.getToken();
      const updated = await api.updateProfile(token, {
        display_name: editForm.display_name,
        bio: editForm.bio,
        location: editForm.location,
        website: editForm.website
      });
      
      setProfile(updated.user);
      cache.invalidateProfile(profileId);
      if (isOwnProfile && setUser) {
        setUser(prev => ({ ...prev, ...updated.user }));
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

// ========== ПОДПИСКА/ОТПИСКА ==========
const handleFollow = async () => {
  try {
    const token = api.getToken();
    const wasFollowing = profile?.is_following;
    
    setProfile(prev => ({ 
      ...prev, 
      is_following: !wasFollowing,
      followers_count: (prev.followers_count || 0) + (wasFollowing ? -1 : 1)
    }));
    
    // Обновляем кэш
    cache.invalidateProfile(profileId);
    
    if (wasFollowing) {
      await api.unfollowUser(token, profileId);
    } else {
      await api.followUser(token, profileId);
    }
    
    // Дополнительно обновляем списки подписчиков/подписок
    loadFollowers();
    loadFollowing();
    
  } catch (err) {
    setProfile(prev => ({ 
      ...prev, 
      is_following: !prev.is_following,
      followers_count: (prev.followers_count || 0) + (prev.is_following ? 1 : -1)
    }));
    console.error('Error following/unfollowing:', err);
  }
};

  // ========== EFFECTS ==========
  // Загрузка профиля, постов и репостов
  useEffect(() => {
    if (!currentUser && !userId) {
      navigate('/login');
      return;
    }
    loadProfile();
    loadPosts();
    loadReposts();
  }, [profileId, currentUser, userId, navigate]);

  // Загрузка подписчиков и подписок сразу после загрузки профиля
  useEffect(() => {
    if (profile && profile.id) {
      const token = api.getToken();
      if (token) {
        loadFollowers();
        loadFollowing();
      }
    }
  }, [profile?.id]);

  // ========== РЕНДЕР ==========
  if (loading) return <LoadingSpinner />;
  if (!profile) return <div className="error-message">Профиль не найден</div>;

  return (
    <div className="profile-container">
      <ProfileHeader 
    profile={profile}
    isOwnProfile={isOwnProfile}
    isFollowing={profile.is_following}
    followersCount={profile.followers_count}
    followingCount={profile.following_count}
    onFollow={handleFollow}
    onEdit={() => setIsEditing(true)}
  />

      {isOwnProfile && (
        <CreatePost 
          token={api.getToken()} 
          onPostCreated={handlePostCreated}
        />
      )}

      <div className="profile-tabs">
        <button 
          className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Посты ({posts.length + reposts.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'followers' ? 'active' : ''}`}
          onClick={() => { setActiveTab('followers'); }}
        >
          Подписчики ({followers.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'following' ? 'active' : ''}`}
          onClick={() => { setActiveTab('following'); }}
        >
          Подписки ({following.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'posts' && (
          <div className="posts-list">
            {allPosts.length === 0 ? (
              <div className="empty-posts">Нет постов</div>
            ) : (
              allPosts.map(item => (
                <Post 
                  key={item.id} 
                  post={item} 
                  token={api.getToken()}
                  isOwnPost={isOwnProfile}
                  currentUserId={currentUser?.id}
                  onPostUpdate={handlePostUpdate}
                  onPostDelete={handlePostDelete}
                  onLikeUpdate={handleLikeUpdate}
                />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'followers' && (
          <div className="followers-list">
            {loadingFollowers ? (
              <div className="loading">Загрузка...</div>
            ) : followers.length === 0 ? (
              <div className="empty-list">Нет подписчиков</div>
            ) : (
              followers.map(follower => (
                <UserListItem 
                  key={follower.id} 
                  user={follower} 
                  token={api.getToken()} 
                  currentUserId={currentUser?.id}
                  onFollowChange={(userId, isNowFollowing) => {
                    setFollowers(prev => prev.map(f => 
                      f.id === userId ? { ...f, is_following: isNowFollowing } : f
                    ));
                  }}
                />
              ))
            )}
          </div>
        )}
        
        {activeTab === 'following' && (
          <div className="following-list">
            {loadingFollowers ? (
              <div className="loading">Загрузка...</div>
            ) : following.length === 0 ? (
              <div className="empty-list">Нет подписок</div>
            ) : (
              following.map(follow => (
                <UserListItem 
                  key={follow.id} 
                  user={follow} 
                  token={api.getToken()} 
                  currentUserId={currentUser?.id}
                  onFollowChange={(userId, isNowFollowing) => {
                    setFollowing(prev => prev.map(f => 
                      f.id === userId ? { ...f, is_following: isNowFollowing } : f
                    ));
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Модальное окно редактирования */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Редактировать профиль</h2>
              <button className="modal-close" onClick={() => setIsEditing(false)}>×</button>
            </div>
            <form onSubmit={handleUpdateProfile}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Отображаемое имя</label>
                  <input
                    type="text"
                    value={editForm.display_name}
                    onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">О себе</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                    className="form-input"
                    rows="4"
                    placeholder="Расскажите о себе..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Местоположение</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({...editForm, location: e.target.value})}
                    className="form-input"
                    placeholder="Город, страна"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Веб-сайт</label>
                  <input
                    type="url"
                    value={editForm.website}
                    onChange={(e) => setEditForm({...editForm, website: e.target.value})}
                    className="form-input"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">Отмена</button>
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMessenger && (
        <Messenger 
          currentUserId={currentUser?.id}
          otherUserId={profile.id}
          otherUserName={profile.display_name}
          otherUserAvatar={profile.avatar_url}
          onClose={() => setShowMessenger(false)}
        />
      )}
    </div>
  );
};

export default ProfilePage;