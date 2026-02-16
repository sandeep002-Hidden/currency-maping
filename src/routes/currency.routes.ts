import { Router } from 'express';
import CurrencyController from '../controllers/currency.controller';
import BullMQHelper from '../helpers/bull-mq.helper';
import { config } from '../config';
const router = Router();

const connection = {
    host: config.redisHost,
    port: parseInt(config.redisPort || "6379"),
    password: config.redisPassword,
    maxRetriesPerRequest: null, 
    connectTimeout: 30000, 
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 1000, 5000);
        return delay;
    },
};

const bullMQHelper = new BullMQHelper('currency-exchange-queue', connection);

(async () => {
    try {
        await bullMQHelper.initialize();
        await bullMQHelper.setupDailyCurrencyFetch();
        console.log('✅ Daily currency fetch job initialized');
    } catch (error) {
        console.error('❌ Failed to initialize daily currency fetch:', error);
    }
})();

const currencyController = new CurrencyController(bullMQHelper);


router.get('/rates', currencyController.getAllRates);


router.get('/rates/:currency', currencyController.getCurrencyRate);

router.get('/rates-hash', currencyController.getAllRatesFromHash);


router.post('/fetch', currencyController.triggerManualFetch);

router.get('/queue-status', currencyController.getQueueStatus);


router.get('/metadata', currencyController.getMetadata);



export default router;
