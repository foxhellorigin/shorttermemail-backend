import redis from 'redis';
import config from './config.js';

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      this.client = redis.createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
          reconnectStrategy: (retries) => {
            console.log(`🔄 Redis reconnecting attempt ${retries}`);
            return Math.min(retries * 100, 3000);
          }
        },
        password: config.redis.password,
        legacyMode: false
      });

      this.setupEventHandlers();
      await this.connect();
      
    } catch (error) {
      console.error('💥 Failed to initialize Redis:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    this.client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('🔗 Connecting to Redis...');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client is ready and connected');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      console.log('🔌 Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis is reconnecting...');
    });
  }

  async connect() {
    try {
      await this.client.connect();
      console.log('🚀 Redis connection established successfully');
      
      // Test the connection
      await this.client.ping();
      console.log('🏓 Redis ping successful');
      
      return true;
    } catch (error) {
      console.error('💥 Failed to connect to Redis:', error);
      throw error;
    }
  }

  async set(key, value, ttl = null) {
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Error setting Redis key:', error);
      return false;
    }
  }

  async get(key) {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Error getting Redis key:', error);
      return null;
    }
  }

  async del(key) {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error('Error deleting Redis key:', error);
      return false;
    }
  }

  async keys(pattern) {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Error getting Redis keys:', error);
      return [];
    }
  }

  async setEx(key, seconds, value) {
    try {
      await this.client.setEx(key, seconds, value);
      return true;
    } catch (error) {
      console.error('Error setting Redis key with expiry:', error);
      return false;
    }
  }

  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error('Error getting TTL:', error);
      return -2; // Key doesn't exist
    }
  }

  async quit() {
    try {
      await this.client.quit();
      console.log('✅ Redis connection closed gracefully');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }

  // Health check
  async health() {
    try {
      await this.client.ping();
      return {
        status: 'healthy',
        connected: this.isConnected
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    }
  }
}

// Create and export a singleton instance
const redisClient = new RedisManager();
export default redisClient;