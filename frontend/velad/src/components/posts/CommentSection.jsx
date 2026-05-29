import React, { useState, useEffect } from 'react';
import { api } from '../../lib/supabase';
import { FaHeart, FaRegHeart, FaReply, FaTrash } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const CommentSection = ({ postId, token, currentUserId, onCommentCountChange }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');

  // Загрузка комментариев
  const loadComments = async () => {
    setLoading(true);
    try {
      const commentsList = await api.getComments(token, postId);
      setComments(commentsList);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Загружаем комментарии при открытии
  useEffect(() => {
    if (expanded) {
      loadComments();
    }
  }, [expanded, postId]);

  // Отправка комментария
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const comment = await api.createComment(token, postId, newComment.trim());
      setComments([comment, ...comments]);
      setNewComment('');
      if (onCommentCountChange) {
        onCommentCountChange(comments.length + 1);
      }
    } catch (err) {
      console.error('Error creating comment:', err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Отправка ответа
  const handleReply = async (parentId) => {
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      const reply = await api.createComment(token, postId, replyContent.trim(), parentId);
      
      // Добавляем ответ к соответствующему комментарию
      setComments(prev => prev.map(comment => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), reply],
            replies_count: (comment.replies_count || 0) + 1
          };
        }
        return comment;
      }));
      
      setReplyContent('');
      setReplyingTo(null);
      if (onCommentCountChange) {
        onCommentCountChange(comments.length + 1);
      }
    } catch (err) {
      console.error('Error posting reply:', err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Удаление комментария
  const handleDelete = async (commentId) => {
    if (!window.confirm('Удалить комментарий?')) return;
    
    try {
      await api.deleteComment(token, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (onCommentCountChange) {
        onCommentCountChange(comments.length - 1);
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert(err.message);
    }
  };

  // Лайк комментария
  const handleLike = async (commentId) => {
    try {
      const result = await api.likeComment(token, commentId);
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            is_liked: result.action === 'liked',
            likes_count: result.likes_count
          };
        }
        // Обновляем лайки в ответах
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(reply => 
              reply.id === commentId 
                ? { ...reply, is_liked: result.action === 'liked', likes_count: result.likes_count }
                : reply
            )
          };
        }
        return comment;
      }));
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const now = new Date();
    const commentDate = new Date(date);
    const diff = Math.floor((now - commentDate) / 1000 / 60);
    
    if (diff < 1) return 'только что';
    if (diff < 60) return `${diff} мин назад`;
    if (diff < 1440) return `${Math.floor(diff / 60)} ч назад`;
    return commentDate.toLocaleDateString('ru-RU');
  };

  // Компонент отдельного комментария
  const CommentItem = ({ comment, level = 0 }) => {
    const isOwnComment = currentUserId === comment.user_id;
    const [showReplyForm, setShowReplyForm] = useState(false);

    return (
      <div className={`comment-item level-${Math.min(level, 3)}`}>
        <Link to={`/profile/${comment.user_id}`} className="comment-avatar">
          <img 
            src={comment.avatar_url || `https://ui-avatars.com/api/?name=${comment.display_name}&background=9146FF&color=fff&size=32`}
            alt={comment.display_name}
          />
        </Link>
        <div className="comment-content">
          <div className="comment-header">
            <Link to={`/profile/${comment.user_id}`}>
              <span className="comment-author">{comment.display_name}</span>
            </Link>
            <span className="comment-date">• {formatDate(comment.created_at)}</span>
          </div>
          <p className="comment-text">{comment.content}</p>
          <div className="comment-actions">
            <button 
              className={`comment-like-btn ${comment.is_liked ? 'liked' : ''}`}
              onClick={() => handleLike(comment.id)}
            >
              {comment.is_liked ? <FaHeart /> : <FaRegHeart />}
              <span>{comment.likes_count || 0}</span>
            </button>
            {level < 3 && (
              <button 
                className="comment-reply-btn"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <FaReply /> Ответить
              </button>
            )}
            {isOwnComment && (
              <button 
                className="comment-delete-btn"
                onClick={() => handleDelete(comment.id)}
              >
                <FaTrash /> Удалить
              </button>
            )}
          </div>
          
          {showReplyForm && (
            <div className="reply-form">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`Ответить ${comment.display_name}...`}
                rows="2"
              />
              <div className="reply-actions">
                <button onClick={() => { setShowReplyForm(false); setReplyContent(''); }} className="cancel-reply-btn">
                  Отмена
                </button>
                <button 
                  onClick={() => {
                    handleReply(comment.id);
                    setShowReplyForm(false);
                  }}
                  disabled={!replyContent.trim() || submitting}
                  className="submit-reply-btn"
                >
                  Ответить
                </button>
              </div>
            </div>
          )}
          
          {comment.replies && comment.replies.length > 0 && (
            <div className="replies-container">
              {comment.replies.map(reply => (
                <CommentItem key={reply.id} comment={reply} level={level + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalComments = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  return (
    <div className="comment-section">
      <button 
        className="show-comments-btn"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Скрыть комментарии' : `Показать комментарии (${totalComments})`}
      </button>

      {expanded && (
        <div className="comments-container">
          <form onSubmit={handleSubmit} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Написать комментарий..."
              rows="2"
              disabled={submitting}
            />
            <button type="submit" disabled={submitting || !newComment.trim()}>
              {submitting ? 'Отправка...' : 'Отправить'}
            </button>
          </form>

          {loading ? (
            <div className="loading-comments">Загрузка комментариев...</div>
          ) : comments.length === 0 ? (
            <div className="no-comments">Пока нет комментариев. Будьте первым!</div>
          ) : (
            <div className="comments-list">
              {comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;