import mongoose from 'mongoose';
import * as config from './config';
import { init } from './bot';
import CopyTradeService from './copyTradeService';

const run = async () => {
    try {
        await mongoose.connect(config.MONGO_URI);
        console.log('MongoDB connected');
        init();
        CopyTradeService.start();
    } catch (error) {
        console.error('MongoDB connection error:', error);
        return;
    }
}

export default { run };