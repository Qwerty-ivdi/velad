import React, { useState } from 'react';
import { FaImage, FaTimes } from 'react-icons/fa';
import { API_URL } from '../../config';

const CreatePost = ({ token, onPostCreated }) => {
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Максимальные ограничения
  const MAX_IMAGES = 4;  
  const MAX_FILE_SIZE_MB = 2;  
  const MAX_TOTAL_SIZE_MB = 5;  

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxSize = 1200;
          
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height * maxSize) / width;
              width = maxSize;
            } else {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          // Создаем canvas для сжатия
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Сжимаем с качеством 0.7
          canvas.toBlob((blob) => {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          }, 'image/jpeg', 0.7);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Проверка на количество изображений
    if (images.length + files.length > MAX_IMAGES) {
      setError(`Максимум ${MAX_IMAGES} изображений на пост`);
      return;
    }
    
    setUploading(true);
    setError(null);
    
    // Проверка общего размера
    let totalSize = images.reduce((sum, img) => {
      // Получаем примерный размер из base64 строки
      const sizeInBytes = (img.length * 3) / 4;
      return sum + sizeInBytes;
    }, 0);
    
    for (const file of files) {
      // Проверка размера файла
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`Файл ${file.name} больше ${MAX_FILE_SIZE_MB}MB`);
        setUploading(false);
        return;
      }
      
      totalSize += file.size;
      if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
        setError(`Общий размер изображений не должен превышать ${MAX_TOTAL_SIZE_MB}MB`);
        setUploading(false);
        return;
      }
    }
    
    try {
      for (const file of files) {
        console.log('📸 Uploading file:', file.name, `(${(file.size / 1024).toFixed(2)}KB)`);
        
        // Сжимаем изображение
        let fileToUpload = file;
        if (file.size > 500 * 1024) {  // Если больше 500KB, сжимаем
          fileToUpload = await compressImage(file);
          console.log('📸 Compressed to:', (fileToUpload.size / 1024).toFixed(2), 'KB');
        }
        
        const formData = new FormData();
        formData.append('file', fileToUpload);
        
        const response = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Upload failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Upload success');
        setImages(prev => [...prev, data.url]);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
      // Очищаем input, чтобы можно было загрузить те же файлы снова
      e.target.value = '';
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && images.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: content.trim(),
          media_urls: images,
          post_type: images.length > 0 ? 'image' : 'text'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create post');
      }
      
      const newPost = await response.json();
      setContent('');
      setImages([]);
      if (onPostCreated) onPostCreated(newPost);
    } catch (err) {
      console.error('Create post error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="create-post">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Что нового? Поделись мыслями..."
          rows="3"
          maxLength={5000}
        />
        
        {images.length > 0 && (
          <div className="image-preview-list">
            {images.map((url, index) => (
              <div key={index} className="image-preview">
                <img src={url} alt={`preview-${index}`} />
                <button type="button" onClick={() => removeImage(index)}>
                  <FaTimes />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="create-post-actions">
          <label className={`image-upload-btn ${images.length >= MAX_IMAGES ? 'disabled' : ''}`}>
            <FaImage />
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={handleImageUpload}
              disabled={uploading || images.length >= MAX_IMAGES}
              style={{ display: 'none' }}
            />
          </label>
          
          <div className="post-stats-info">
            {images.length > 0 && (
              <span className="images-count">{images.length}/{MAX_IMAGES}</span>
            )}
            <span className="char-count">{content.length}/5000</span>
          </div>
          
          <button 
            type="submit" 
            disabled={uploading || (!content.trim() && images.length === 0)}
            className="create-post-btn"
          >
            {uploading ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
};

export default CreatePost;