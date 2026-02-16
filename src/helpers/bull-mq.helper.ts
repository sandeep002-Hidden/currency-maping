import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import axios from 'axios';
import { ExchangeRateResponse } from '../types/exchange.types';
import RedisClient from '../config/redis.config';

interface CurrencyJobData {
    timestamp: number;
}

class BullMQHelper {
    private queue: Queue;
    private worker: Worker;
    private redisClient: ReturnType<typeof RedisClient.getInstance>;
    private isRedisConnected: boolean = false;

    constructor(queueName: string, connection: any) {
        this.redisClient = RedisClient.getInstance();
        this.queue = new Queue(queueName, { connection });
        
        this.worker = new Worker(
            queueName, 
            async (job: Job) => {
                await this.processCurrencyJob(job);
            }, 
            { connection }
        );

        this.worker.on('completed', (job) => {
            console.log(`✅ Job ${job.id} completed successfully at ${new Date()}`);
        });

        this.worker.on('failed', (job, err) => {
            console.error(`❌ Job ${job?.id} failed:`, err.message);
        });
    }

    async initialize() {
        if (!this.isRedisConnected) {
            await RedisClient.connect();
            this.isRedisConnected = true;
            console.log('✅ Redis connected for BullMQHelper');
        }
    }

    async setupDailyCurrencyFetch() {
        try {
            await this.queue.upsertJobScheduler(
                'daily-currency-fetch',
                {
                    pattern: '0 0 6 * * *', 
                },
                {
                    name: 'fetch-currency-rates',
                    data: {
                        timestamp: Date.now()
                    } as CurrencyJobData,
                    opts: {
                        attempts: 3, 
                        backoff: {
                            type: 'exponential',
                            delay: 5000, 
                        },
                    },
                }
            );
        } catch (error) {
            console.error('Failed to setup daily currency fetch:', error);
            throw error;
        }
    }

    private async processCurrencyJob(job: Job) {
        console.log(`🔄 Processing currency fetch job ${job.id} at ${new Date()}`);
        
        try {
            const exchangeRates = await this.fetchExchangeRates();
            
            console.log(`📊 Fetched exchange rates:`, {
                base: exchangeRates.base_code,
                ratesCount: Object.keys(exchangeRates.conversion_rates).length,
                timestamp: new Date()
            });

            await this.storeExchangeRates(exchangeRates);

            return exchangeRates;
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            throw error; 
        }
    }

    private async fetchExchangeRates(): Promise<ExchangeRateResponse> {
        // const apiKey = config.exchangeApiKey;
        const apiUrl = config.exchangeApiUrl;

        if (!apiUrl) {
            throw new Error('Exchange API credentials not configured');
        }

        try {
            const response = await axios.get(`${apiUrl}`);

            if (!response.data || !response.data.conversion_rates) {
                throw new Error('Invalid response from exchange rate API');
            }

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error('API Error:', {
                    status: error.response?.status,
                    message: error.message,
                    data: error.response?.data
                });
            }
            throw error;
        }
    }

private async storeExchangeRates(rates: ExchangeRateResponse): Promise<void> {
    console.log('💾 Storing exchange rates in Redis...');
    
    try {
        const timestamp = Date.now();
        const redisKey = 'exchange:rates:latest';
        const historyKey = `exchange:rates:history:${new Date().toISOString().split('T')[0]}`; // YYYY-MM-DD
        
        const dataToStore = {
            ...rates,
            fetchedAt: timestamp,
            fetchedDate: new Date().toISOString()
        };

        await this.redisClient.setEx(
            redisKey,
            25 * 60 * 60, // 25 hours 
            JSON.stringify(dataToStore)
        );

        if (rates.conversion_rates) {
            const hashKey = 'exchange:rates:hash';
            
            if (rates.base_code) {
                await this.redisClient.hSet(hashKey, 'base', rates.base_code);
            }
            
            await this.redisClient.hSet(hashKey, 'timestamp', timestamp.toString());
            
            for (const [currency, rate] of Object.entries(rates.conversion_rates)) {
                await this.redisClient.hSet(hashKey, currency, rate.toString());
            }
        }
        await this.redisClient.setEx(
            historyKey,
            7 * 24 * 60 * 60, 
            JSON.stringify(dataToStore)
        );

        await this.redisClient.hSet('exchange:metadata', 'lastUpdate', timestamp.toString());
        await this.redisClient.hSet('exchange:metadata', 'lastUpdateDate', new Date().toISOString());
        await this.redisClient.hSet('exchange:metadata', 'currencyCount', Object.keys(rates.conversion_rates || {}).length.toString());
        await this.redisClient.hSet('exchange:metadata', 'baseCurrency', rates.base_code || 'N/A');

        console.log(`✅ Exchange rates stored successfully in Redis (${Object.keys(rates.conversion_rates || {}).length} currencies)`);
    } catch (error) {
        console.error('❌ Error storing exchange rates in Redis:', error);
        throw error;
    }
}

async getExchangeRates(): Promise<ExchangeRateResponse | null> {
    try {
        const data = await this.redisClient.get('exchange:rates:latest');
        if (!data) {
            console.log('No exchange rates found in Redis');
            return null;
        }
        return JSON.parse(data);
    } catch (error) {
        console.error('Error retrieving exchange rates from Redis:', error);
        return null;
    }
}

async getCurrencyRate(currency: string): Promise<number | null> {
    try {
        const rate = await this.redisClient.hGet('exchange:rates:hash', currency.toUpperCase());
        return rate ? parseFloat(rate) : null;
    } catch (error) {
        console.error(`Error retrieving rate for ${currency}:`, error);
        return null;
    }
}

async getAllRatesFromHash(): Promise<Record<string, number> | null> {
    try {
        const allRates = await this.redisClient.hGetAll('exchange:rates:hash');
        if (!allRates || Object.keys(allRates).length === 0) {
            return null;
        }
        
        const rates: Record<string, number> = {};
        for (const [key, value] of Object.entries(allRates)) {
            if (key !== 'base' && key !== 'timestamp') {
                rates[key] = parseFloat(value);
            }
        }
        
        return rates;
    } catch (error) {
        console.error('Error retrieving all rates from Redis:', error);
        return null;
    }
}

    async triggerManualFetch() {
        try {
            const job = await this.queue.add(
                'manual-currency-fetch',
                {
                    timestamp: Date.now()
                } as CurrencyJobData,
                {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    },
                }
            );
            console.log(`✅ Manual currency fetch job queued: ${job.id}`);
            return job;
        } catch (error) {
            console.error('Failed to trigger manual fetch:', error);
            throw error;
        }
    }
    async getQueueStatus() {
        const jobCounts = await this.queue.getJobCounts();
        const schedulers = await this.queue.getJobSchedulers();
        
        return {
            jobCounts,
            schedulers: Array.from(schedulers.values())
        };
    }

    /**
     * Clean up old jobs
     */
    async cleanup(gracePeriodMs: number = 24 * 60 * 60 * 1000) {
        await this.queue.clean(gracePeriodMs, 1000, 'completed');
        await this.queue.clean(gracePeriodMs, 1000, 'failed');
        console.log('✅ Queue cleanup completed');
    }

    async close() {
        await this.worker.close();
        await this.queue.close();
        console.log('✅ BullMQ connections closed');
    }
}

export default BullMQHelper;