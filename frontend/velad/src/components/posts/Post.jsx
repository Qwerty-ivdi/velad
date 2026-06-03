// src/components/posts/Post.jsx
import React, { useState } from 'react';
import { api } from '../../lib/supabase';
import { FaHeart, FaRegHeart, FaComment, FaShare, FaEdit, FaTrash, FaTimes, FaCheck, FaRetweet } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import CommentSection from './CommentSection';

const Post = ({ post, token, isOwnPost = false, currentUserId, onPostUpdate, onPostDelete, onLikeUpdate }) => {
  const [liked, setLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [reposted, setReposted] = useState(post.is_reposted || false);
  const [repostsCount, setRepostsCount] = useState(post.reposts_count || 0);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostContent, setRepostContent] = useState('');

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000 / 60);
    
    if (diff < 1) return 'только что';
    if (diff < 60) return `${diff} мин назад`;
    if (diff < 1440) return `${Math.floor(diff / 60)} ч назад`;
    return d.toLocaleDateString('ru-RU');
  };

  const handleLike = async () => {
  if (loading) return;
  setLoading(true);
  try {
    await api.likePost(token, post.id);
    const newLiked = result.action === 'liked';
    const newLikesCount = result.likes_count;
    setLiked(newLiked);
    setLikesCount(newLikesCount);
    if (onLikeUpdate) onLikeUpdate(post.id, newLiked, newLikesCount);
  } catch (err) {
    console.error('Like error:', err);
  } finally {
    setLoading(false);
  }
};

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    setLoading(true);
    try {
      const updated = await api.updatePost(token, post.id, editContent.trim());
      const updatedPost = { ...post, content: updated.content, updated_at: updated.updated_at };
      setIsEditing(false);
      if (onPostUpdate) onPostUpdate(updatedPost);
    } catch (err) {
      console.error('Edit error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await api.deletePost(token, post.id);
      if (onPostDelete) onPostDelete(post.id);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRepost = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (reposted) {
        await api.removeRepost(token, post.id);
        setReposted(false);
        setRepostsCount(prev => prev - 1);
      } else {
        const result = await api.repostPost(token, post.id, repostContent);
        setReposted(true);
        setRepostsCount(prev => prev + 1);
        setShowRepostModal(false);
        setRepostContent('');
      }
    } catch (err) {
      console.error('Repost error:', err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== РЕПОСТ ====================
  if (post.repost_of) {
    return (
      <div className="post-card repost-card">
        <div className="repost-header">
          <FaRetweet className="repost-icon" />
          <span>{post.display_name} репостнул(а)</span>
          {isOwnPost && (
            <div className="post-actions">
              <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)} disabled={loading}>
                <FaTrash />
              </button>
            </div>
          )}
        </div>
        <div className="repost-content">
          <Link to={`/profile/${post.original_author_id}`} className="repost-author">
            <img 
              src={post.original_author_avatar || `https://ui-avatars.com/api/?name=${post.original_author_name}&background=9146FF&color=fff&size=24`} 
              alt=""
            />
            <strong>{post.original_author_name}</strong>
            <span>@{post.original_author_username}</span>
          </Link>
          
          <p className="repost-original-text">{post.original_content}</p>
          
          {post.original_media_urls && post.original_media_urls.length > 0 && (
            <div className={`repost-media ${post.original_media_urls.length === 1 ? 'single' : ''} ${post.original_media_urls.length === 2 ? 'grid-2' : ''}`}>
              {post.original_media_urls.map((url, i) => (
                <img 
                  key={i} 
                  src={url} 
                  alt={`repost-media-${i}`}
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
            </div>
          )}
          
          {post.repost_comment && (
            <div className="repost-comment">
              <span className="repost-comment-icon">💬</span>
              <p>{post.repost_comment}</p>
            </div>
          )}
        </div>
        <div className="post-stats">
          <button className={`like-btn ${liked ? 'liked' : ''}`} onClick={handleLike} disabled={loading}>
            {liked ? <FaHeart /> : <FaRegHeart />} <span>{likesCount}</span>
          </button>
          <button className="comment-btn" onClick={() => setShowComments(!showComments)}>
            <FaComment /> <span>{post.comments_count || 0}</span>
          </button>
          <button className="share-btn"><FaShare /></button>
        </div>

        {showComments && (
          <CommentSection 
            postId={post.id} 
            token={token} 
            currentUserId={currentUserId}
            onCommentCountChange={(newCount) => {
              if (onPostUpdate) {
                onPostUpdate({ ...post, comments_count: newCount });
              }
            }}
          />
        )}

        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Удалить репост?</h2>
                <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
              </div>
              <div className="modal-body">
                <p>Вы уверены, что хотите удалить этот репост?</p>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={loading}>Отмена</button>
                <button className="btn-danger" onClick={handleDelete} disabled={loading}>{loading ? 'Удаление...' : 'Удалить'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== ОБЫЧНЫЙ ПОСТ ====================
  return (
    <div className="post-card">
      <div className="post-header">
        <Link to={`/profile/${post.user_id}`}>
          <img 
            src={post.avatar_url || `https://ui-avatars.com/api/?name=${post.display_name || post.username}&background=9146FF&color=fff&size=48`} 
            alt=""
            className="post-avatar"
          />
        </Link>
        <div className="post-author">
          <Link to={`/profile/${post.user_id}`}>
            <h3>{post.display_name || post.username}</h3>
          </Link>
          <span>@{post.username} • {formatDate(post.created_at)}</span>
        </div>
        {isOwnPost && (
          <div className="post-actions">
            <button className="edit-btn" onClick={() => setIsEditing(true)} disabled={loading}>
              <FaEdit />
            </button>
            <button className="delete-btn" onClick={() => setShowDeleteConfirm(true)} disabled={loading}>
              <FaTrash />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="post-edit-mode">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="edit-textarea"
            rows="3"
            autoFocus
          />
          <div className="edit-actions">
            <button className="cancel-edit-btn" onClick={() => { setIsEditing(false); setEditContent(post.content || ''); }}>
              <FaTimes /> Отмена
            </button>
            <button className="save-edit-btn" onClick={handleEdit} disabled={loading || !editContent.trim()}>
              <FaCheck /> {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="post-content">
            <p>{post.content}</p>
            {post.media_urls?.length > 0 && (
              <div className={`post-media ${post.media_urls.length === 1 ? 'single' : ''} ${post.media_urls.length === 2 ? 'grid-2' : ''} ${post.media_urls.length === 3 ? 'grid-3' : ''}`}>
                {post.media_urls.map((url, i) => (
                  <img key={i} src={url} alt="" />
                ))}
              </div>
            )}
          </div>
          <div className="post-stats">
            <button className={`like-btn ${liked ? 'liked' : ''}`} onClick={handleLike} disabled={loading}>
              {liked ? <FaHeart /> : <FaRegHeart />} <span>{likesCount}</span>
            </button>
            <button className="comment-btn" onClick={() => setShowComments(!showComments)}>
              <FaComment /> <span>{post.comments_count || 0}</span>
            </button>
            <button className="repost-btn" onClick={() => setShowRepostModal(true)} disabled={loading}>
              <FaRetweet /> <span>{repostsCount}</span>
            </button>
            <button className="share-btn"><FaShare /></button>
          </div>
        </>
      )}

      {showComments && (
        <CommentSection 
          postId={post.id} 
          token={token} 
          currentUserId={currentUserId}
          onCommentCountChange={(newCount) => {
            if (onPostUpdate) {
              onPostUpdate({ ...post, comments_count: newCount });
            }
          }}
        />
      )}

      {/* Модальное окно репоста */}
      {showRepostModal && (
        <div className="modal-overlay" onClick={() => setShowRepostModal(false)}>
          <div className="modal-content repost-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Репост</h3>
              <button className="modal-close" onClick={() => setShowRepostModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="repost-preview">
                <div className="repost-original">
                  <img 
                    src={post.avatar_url || `https://ui-avatars.com/api/?name=${post.display_name}&background=9146FF&color=fff&size=24`} 
                    alt=""
                  />
                  <div>
                    <strong>{post.display_name}</strong>
                    <p>{post.content?.substring(0, 100)}{post.content?.length > 100 ? '...' : ''}</p>
                  </div>
                </div>
              </div>
              <textarea
                value={repostContent}
                onChange={(e) => setRepostContent(e.target.value)}
                placeholder="Добавить комментарий (необязательно)..."
                rows="3"
                className="repost-textarea"
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRepostModal(false)}>Отмена</button>
              <button className="btn-primary" onClick={handleRepost}>
                {reposted ? 'Отменить репост' : 'Репостнуть'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Удалить пост?</h2>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Вы уверены, что хотите удалить этот пост? Это действие нельзя отменить.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={loading}>Отмена</button>
              <button className="btn-danger" onClick={handleDelete} disabled={loading}>{loading ? 'Удаление...' : 'Удалить'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Post;