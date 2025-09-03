const Redis = require('ioredis');

class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.enabled = process.env.REDIS_ENABLED !== 'false';
    if (this.enabled) {
      this.init();
    } else {
      console.warn('Redis is disabled by REDIS_ENABLED flag. Running without Redis cache.');
    }
  }

  async init() {
    if (!this.enabled) return;
    try {
      // Redis configuration
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      this.redis = new Redis(redisConfig);

      this.redis.on('connect', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (err) => {
        console.warn('Redis connection error:', err.message);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        console.warn('Redis connection closed');
        this.isConnected = false;
      });

      // Test connection
      await this.redis.ping();
      
    } catch (error) {
      console.warn('Redis initialization failed:', error.message);
      console.warn('Running without Redis cache');
      this.isConnected = false;
    }
  }

  // Get data from cache
  async get(key) {
    if (!this.enabled || !this.isConnected) return null;
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Redis GET error:', error.message);
      return null;
    }
  }

  // Set data in cache
  async set(key, data, ttl = 3600) {
    if (!this.enabled || !this.isConnected) return false;
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn('Redis SET error:', error.message);
      return false;
    }
  }

  // Delete data from cache
  async del(key) {
    if (!this.enabled || !this.isConnected) return false;
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.warn('Redis DEL error:', error.message);
      return false;
    }
  }

  // Clear multiple keys with pattern
  async clearPattern(pattern) {
    if (!this.enabled || !this.isConnected) return false;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.warn('Redis CLEAR PATTERN error:', error.message);
      return false;
    }
  }

  // Get cache with fallback
  async getWithFallback(key, fallbackFn, ttl = 3600) {
    if (!this.enabled || !this.isConnected) return await fallbackFn();
    try {
      // Try to get from cache first
      let data = await this.get(key);
      
      if (data) {
        return data;
      }

      // If not in cache, execute fallback function
      data = await fallbackFn();
      
      if (data) {
        // Store in cache for future requests
        await this.set(key, data, ttl);
      }
      
      return data;
    } catch (error) {
      console.warn('Cache fallback error:', error.message);
      // If cache fails, just return fallback data
      return await fallbackFn();
    }
  }

  // Cache keys generator
  keys = {
    product: (id) => `product:${id}`,
    products: (page, limit, filters) => `products:${page}:${limit}:${JSON.stringify(filters)}`,
    category: (id) => `category:${id}`,
    categories: () => 'categories:all',
    silverPrice: () => 'silver:price',
    userCart: (userId) => `cart:${userId}`,
    orderStats: (userId) => `order:stats:${userId}`,
    popularProducts: () => 'products:popular',
    trendingProducts: () => 'products:trending',
    brands: () => 'brands:all',
    colors: () => 'colors:all'
  };

  // TTL constants (in seconds)
  TTL = {
    SHORT: 300,      // 5 minutes
    MEDIUM: 1800,    // 30 minutes
    LONG: 3600,      // 1 hour
    EXTRA_LONG: 86400 // 24 hours
  };
}

module.exports = new CacheService();
