export const config = {
    port: process.env.PORT || '3000',
    // exchangeApiKey: process.env.EXCHNAGE_API_KEY || '',
    exchangeApiUrl: process.env.EXCHNAGE_API_URL || '',
    redisUrl: process.env.REDIS_URL || '',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: process.env.REDIS_PORT || '6379',
    redisPassword: process.env.REDIS_PASSWORD || '',
};
