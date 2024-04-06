import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import express from 'express';

export async function initializeQueueDashboard(queue: Queue) {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/');

    createBullBoard({
        queues: [new BullMQAdapter(queue)],
        serverAdapter: serverAdapter,
    });

    const app = express();

    app.use('/', serverAdapter.getRouter());

    // other configurations of your server

    app.listen(4000, () => {
        console.log('Running on 4000...');
        console.log('For the UI, open http://localhost:4000/');
    });
}