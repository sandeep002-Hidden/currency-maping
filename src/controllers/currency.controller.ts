import { Request, Response } from 'express';
import BullMQHelper from '../helpers/bull-mq.helper';
import { successResponse, errorResponse } from '../utils/response.util';
import RedisClient from '../config/redis.config';

class CurrencyController {
    private bullMQHelper: BullMQHelper;

    constructor(bullMQHelper: BullMQHelper) {
        this.bullMQHelper = bullMQHelper;
    }

    /**
     * Get all exchange rates from Redis cache
     */
    getAllRates = async (req: Request, res: Response) => {
        try {
            const rates = await this.bullMQHelper.getExchangeRates();
            
            if (!rates) {
                return res.status(404).json(
                    errorResponse('No exchange rates found. Please trigger a manual fetch.')
                );
            }

            return res.status(200).json(
                successResponse(
                    'Exchange rates retrieved successfully',
                    rates
                )
            );
        } catch (error) {
            console.error('Error fetching exchange rates:', error);
            return res.status(500).json(
                errorResponse(
                    'Failed to retrieve exchange rates',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            );
        }
    };

    /**
     * Get a specific currency rate
     */
    getCurrencyRate = async (req: Request, res: Response) => {
        try {
            let { currency } = req.params;

            if (!currency || typeof currency !== 'string') {
                return res.status(400).json(
                    errorResponse('Currency code is required')
                );
            }

            // TypeScript now knows currency is a string
            const rate = await this.bullMQHelper.getCurrencyRate(currency);

            if (rate === null) {
                return res.status(404).json(
                    errorResponse(`Rate not found for currency: ${currency.toUpperCase()}`)
                );
            }

            return res.status(200).json(
                successResponse(
                    `Rate for ${currency.toUpperCase()} retrieved successfully`,
                    {
                        currency: currency.toUpperCase(),
                        rate,
                        timestamp: new Date().toISOString()
                    }
                )
            );
        } catch (error) {
            console.error('Error fetching currency rate:', error);
            return res.status(500).json(
                errorResponse(
                    'Failed to retrieve currency rate',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            );
        }
    };

    /**
     * Get all rates from Redis hash
     */
    getAllRatesFromHash = async (req: Request, res: Response) => {
        try {
            const rates = await this.bullMQHelper.getAllRatesFromHash();

            if (!rates) {
                return res.status(404).json(
                    errorResponse('No exchange rates found in hash. Please trigger a manual fetch.')
                );
            }

            return res.status(200).json(
                successResponse(
                    'Exchange rates retrieved successfully from hash',
                    {
                        rates,
                        count: Object.keys(rates).length,
                        timestamp: new Date().toISOString()
                    }
                )
            );
        } catch (error) {
            console.error('Error fetching rates from hash:', error);
            return res.status(500).json(
                errorResponse(
                    'Failed to retrieve exchange rates from hash',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            );
        }
    };

    /**
     * Manually trigger a currency fetch
     */
    triggerManualFetch = async (req: Request, res: Response) => {
        try {
            const job = await this.bullMQHelper.triggerManualFetch();

            return res.status(200).json(
                successResponse(
                    'Manual currency fetch triggered successfully',
                    {
                        jobId: job.id,
                        jobName: job.name,
                        queuedAt: new Date().toISOString()
                    }
                )
            );
        } catch (error) {
            console.error('Error triggering manual fetch:', error);
            return res.status(500).json(
                errorResponse(
                    'Failed to trigger manual fetch',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            );
        }
    };

    /**
     * Get queue status and scheduler info
     */
    getQueueStatus = async (req: Request, res: Response) => {
        try {
            const status = await this.bullMQHelper.getQueueStatus();

            return res.status(200).json(
                successResponse(
                    'Queue status retrieved successfully',
                    status
                )
            );
        } catch (error) {
            console.error('Error fetching queue status:', error);
            return res.status(500).json(
                errorResponse(
                    'Failed to retrieve queue status',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            );
        }
    };

    /**
     * Get Redis metadata
     */
    getMetadata = async (req: Request, res: Response) => {
        try {
            const redisClient = RedisClient.getInstance();
            const metadata = await redisClient.hGetAll('exchange:metadata');

            if (!metadata || Object.keys(metadata).length === 0) {
                return res.status(404).json(
                    errorResponse('No metadata found')
                );
            }

            return res.status(200).json(
                successResponse(
                    'Metadata retrieved successfully',
                    metadata
                )
            );
        } catch (error) {
            console.error('Error fetching metadata:', error);
            return res.status(500).json(
                errorResponse(
                    'Failed to retrieve metadata',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            );
        }
    };

    /**
     * Health check endpoint
     */
    healthCheck = async (req: Request, res: Response) => {
        try {
            const redisHealthy = await RedisClient.testConnection();
            const queueStatus = await this.bullMQHelper.getQueueStatus();

            return res.status(200).json(
                successResponse(
                    'Service is healthy',
                    {
                        status: 'UP',
                        redis: redisHealthy ? 'CONNECTED' : 'DISCONNECTED',
                        queue: queueStatus,
                        timestamp: new Date().toISOString()
                    }
                )
            );
        } catch (error) {
            console.error('Health check failed:', error);
            return res.status(503).json(
                errorResponse(
                    'Service is unhealthy',
                    error instanceof Error ? error.message : 'Unknown error'
                )
            );
        }
    };
}

export default CurrencyController;
