// src/components/posts/CreatePost.jsx
import React, { useState, useRef } from 'react';
import { FaImage, FaTimes, FaSpinner } from 'react-icons/fa';
import { api } from '../../lib/supabase';

const CreatePost = ({ token, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [images, setImages] = useState([]);
  const fileInputRef = useRef(null);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`Файл ${file.name} слишком большой (макс. 5MB)`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        setError(`Файл ${file.name} не является изображением`);
        continue;
      }
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('http://localhost:5000/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Ошибка загрузки');
        setImages(prev => [...prev, result.url]);
      } catch (err) {
        setError(err.message);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && images.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const post = await api.createPost(token, {
        content: content.trim(),
        post_type: images.length > 0 ? 'image' : 'text',
        media_urls: images
      });
      setContent('');
      setImages([]);
      if (onPostCreated) onPostCreated(post);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post-card">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Что нового? Поделись мыслями..."
          rows="3"
          disabled={loading || uploading}
        />
        
        {images.length > 0 && (
          <div className="image-preview">
            {images.map((img, i) => (
              <div key={i} className="image-preview-item">
                <img src={`http://localhost:5000${img}`} alt="" />
                <button type="button" onClick={() => removeImage(i)}><FaTimes /></button>
              </div>
            ))}
          </div>
        )}
        
        <div className="create-post-actions">
          <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={loading || uploading}>
            {uploading ? <FaSpinner className="spinning" /> : <FaImage />} {uploading ? 'Загрузка...' : 'Фото'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
          <button type="submit" disabled={loading || uploading || (!content.trim() && images.length === 0)}>
            {loading ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
};

export default CreatePost;