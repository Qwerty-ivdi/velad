class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 минут
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data: data,
      expiry: Date.now() + ttl
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Специальные методы для разных типов данных
  getProfile(userId) {
    return this.get(`profile_${userId}`);
  }

  setProfile(userId, data) {
    this.set(`profile_${userId}`, data, 2 * 60 * 1000); // 2 минуты
  }

  getPosts(userId) {
    return this.get(`posts_${userId}`);
  }

  setPosts(userId, data) {
    this.set(`posts_${userId}`, data, 1 * 60 * 1000); // 1 минута
  }

  getComments(postId) {
    return this.get(`comments_${postId}`);
  }

  setComments(postId, data) {
    this.set(`comments_${postId}`, data, 30 * 1000); // 30 секунд
  }

  invalidateProfile(userId) {
    this.delete(`profile_${userId}`);
    this.delete(`posts_${userId}`);
  }
}

export default new CacheService();