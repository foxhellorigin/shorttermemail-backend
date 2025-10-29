import redis from 'redis';
import config from './config.js';

const redisClient = redis.createClient({
    socket: {
        host: config.redis.host,
        port: config.redis.port
    },
    password: config.redis.password
});

redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('🔗 Connecting to Redis...');
});

redisClient.on('ready', () => {
    console.log('✅ Redis client is ready');
});

redisClient.on('end', () => {
    console.log('🔌 Redis connection closed');
});

// Connect to Redis
(async () => {
    try {
        await redisClient.connect();
        console.log('🚀 Redis connection established successfully');
        
        // Test the connection
        await redisClient.ping();
        console.log('🏓 Redis ping successful');
    } catch (err) {
        console.error('💥 Failed to connect to Redis:', err);
        process.exit(1);
    }
})();

export default redisClient;