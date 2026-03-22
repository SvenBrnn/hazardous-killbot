import { Client } from 'discord.js';
import axios from 'axios';
import cron from 'node-cron';
import { Queue, Worker } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { sendKillMailToDiscord } from './jobs/sendKill';
import { initializeQueueDashboard } from './lib/queueDashboard';
import processKill from './jobs/processKill';
import { IR2Z2Sequence, IZkillPoll } from './interfaces/zkill';
import { transformKill } from './lib/killTransformer';
import PollingSequenceModel from './models/pollingSequence';
import SubscriptionModel from './models/subscription';

export enum SubscriptionType {
    ALL = 'all',
    PUBLIC = 'public',
    REGION = 'region',
    CONSTELLATION = 'constellation',
    SYSTEM = 'system',
    corporation = 'corporation',
    ALLIANCE = 'alliance',
    CHARACTER = 'character',
    GROUP = 'group',
    SHIP = 'ship',
    LINK = 'link',
}

export enum LimitType {
    REGION = 'region',
    CONSTELLATION = 'constellation',
    SYSTEM = 'system',
    NONE = 'none'
}

export enum KillType {
    KILLS = 'kills',
    LOSSES = 'losses'
}

export interface Subscription {
    subType: SubscriptionType
    id?: number
    minValue: number,
    limitType: LimitType
    limitIds?: string
    killType?: KillType
}

interface PollingJobData {
    sequence?: number
}

const R2Z2_EPHEMERAL_BASE_URL = 'https://r2z2.zkillboard.com/ephemeral';
const R2Z2_SEQUENCE_URL = `${R2Z2_EPHEMERAL_BASE_URL}/sequence.json`;
const POLLING_SUCCESS_DELAY_MS = 100;
const POLLING_EMPTY_DELAY_MS = 6000;
const POLLING_ERROR_DELAY_MS = 6000;
const SEQUENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class ZKillSubscriber {
    protected static instance: ZKillSubscriber;
    protected doClient: Client;


    protected worker_polling: Worker | undefined;
    protected queue_polling?: Queue;

    protected worker: Worker | undefined;
    protected queue?: Queue;

    protected constructor(client: Client) {
        this.migrateFromJsonFiles().catch(console.error);
        this.doClient = client;
    }

    public start() {
        console.log('Discord is ready — starting BullMQ workers and polling.');

        // Initialize the queues (jobs can be queued before workers start)
        this.queue_polling = new Queue('polling', {
            connection: { host: 'redis', port: 6379 },
        });

        this.queue = new Queue('zkillboard', {
            connection: { host: 'redis', port: 6379 },
        });

        // initialize the dashboard
        initializeQueueDashboard(this.queue, this.queue_polling);

        // On kill signal, make sure the workers are closed properly
        process.on('SIGINT', async () => {
            console.log('SIGINT received, closing workers...');
            await this.worker_polling?.close();
            await this.worker?.close();
            console.log('Workers closed.');
            process.exit(0);
        });

        // Initialize the polling worker
        this.worker_polling = new Worker('polling', async (job) => {
            const pollingJobData = job.data as PollingJobData;
            let currentSequence: number | undefined = pollingJobData.sequence;
            let nextSequence: number | undefined = pollingJobData.sequence;
            let nextDelay: number;

            try {
                currentSequence = await this.resolvePollingSequence(pollingJobData);
                nextSequence = currentSequence;

                const response = await axios.get<IZkillPoll>(`${R2Z2_EPHEMERAL_BASE_URL}/${currentSequence}.json`, {
                    validateStatus: () => true,
                });

                if (response.status === 200 && response.data) {
                    const rawData: IZkillPoll = response.data;
                    const data = await transformKill(rawData);
                    const processKillJobId = 'kill-sequence-' + currentSequence.toString();
                    const existingProcessKillJob = await this.queue?.getJob(processKillJobId);

                    if (!existingProcessKillJob) {
                        await this.queue?.add(
                            'process-kill',
                            data,
                            {
                                jobId: processKillJobId,
                                removeOnComplete: true,
                                backoff: { type: 'fixed', delay: 60000 },
                                attempts: 10,
                                removeOnFail: { age: 86400 },
                            },
                        );
                    }
                    else {
                        console.warn(`Process queue job for R2Z2 sequence ${currentSequence} already exists, advancing to the next sequence.`);
                    }

                    nextSequence = currentSequence + 1;
                    await this.savePollingSequence(nextSequence);
                    nextDelay = POLLING_SUCCESS_DELAY_MS;
                }
                else if (response.status === 404) {
                    nextDelay = POLLING_EMPTY_DELAY_MS;
                }
                else if (response.status === 429) {
                    console.warn(`R2Z2 rate limit reached for sequence ${currentSequence}, retrying in ${POLLING_EMPTY_DELAY_MS}ms.`);
                    nextDelay = POLLING_EMPTY_DELAY_MS;
                }
                else {
                    console.warn(`Unexpected R2Z2 response status ${response.status} for sequence ${currentSequence}, retrying in ${POLLING_ERROR_DELAY_MS}ms.`);
                    nextDelay = POLLING_ERROR_DELAY_MS;
                }
            }
            catch (error) {
                console.error(`Failed to fetch or process R2Z2 sequence ${currentSequence ?? 'bootstrap'}:`, error);
                nextDelay = POLLING_ERROR_DELAY_MS;
            }

            await this.schedulePollingJob(nextSequence, nextDelay);
        }, {
            connection: { host: 'redis', port: 6379 },
            concurrency: 1,
        });

        // Initialize the send/process worker
        this.worker = new Worker('zkillboard', async (job) => {
            const data = job.data;
            if (job.name === 'process-kill' && this.queue) {
                await processKill(this, this.queue, job);
            }
            else {
                await sendKillMailToDiscord(this, data.guildId, data.channelId, data.subType, data.data, data.subId, data.messageColor);
            }
        }, {
            connection: { host: 'redis', port: 6379 },
            concurrency: 10,
        });

        // Start the polling cron and immediately check the queue
        cron.schedule('* * * * *', this.checkPollingQueue.bind(this));
        this.checkPollingQueue();
    }

    protected checkPollingQueue() {
        // Check if queue_polling has any jobs in running or waiting state
        this.queue_polling?.getJobCounts().then((counts) => {
            if (counts.waiting == 0 && counts.active == 0 && counts.delayed == 0) {
                console.log('Polling queue is empty, adding a new job.');
                this.schedulePollingJob(undefined, 10).catch((error) => {
                    console.error('Failed to schedule polling job:', error);
                });
            }
        });
    }

    protected async resolvePollingSequence(jobData?: PollingJobData): Promise<number> {
        if (jobData?.sequence && Number.isInteger(jobData.sequence) && jobData.sequence > 0) {
            return jobData.sequence;
        }

        const savedSequence = await this.loadPollingSequence();
        if (savedSequence) {
            return savedSequence;
        }

        const bootstrapSequence = await this.fetchLatestSequence();
        this.savePollingSequence(bootstrapSequence);
        return bootstrapSequence;
    }

    protected async fetchLatestSequence(): Promise<number> {
        const response = await axios.get<IR2Z2Sequence>(R2Z2_SEQUENCE_URL);
        if (!response.data || !Number.isInteger(response.data.sequence) || response.data.sequence <= 0) {
            throw new Error('INVALID_R2Z2_SEQUENCE_RESPONSE');
        }

        return response.data.sequence;
    }

    protected async loadPollingSequence(): Promise<number | undefined> {
        try {
            const doc = await PollingSequenceModel.findOne().sort({ savedAt: -1 }).lean();
            if (!doc) {
                return undefined;
            }
            if ((Date.now() - new Date(doc.savedAt).getTime()) > SEQUENCE_MAX_AGE_MS) {
                console.warn('Saved polling sequence is older than 24 hours, bootstrapping from latest R2Z2 sequence.');
                return undefined;
            }
            if (Number.isInteger(doc.sequence) && doc.sequence > 0) {
                return doc.sequence;
            }
        }
        catch (error) {
            console.error('Failed to load saved polling sequence from MongoDB:', error);
        }
        return undefined;
    }

    protected async savePollingSequence(sequence: number): Promise<void> {
        try {
            await PollingSequenceModel.deleteMany({});
            await PollingSequenceModel.create({ sequence, savedAt: new Date() });
        }
        catch (error) {
            console.error('Failed to save polling sequence to MongoDB:', error);
        }
    }

    protected async schedulePollingJob(sequence?: number, delay: number = 0) {
        await this.queue_polling?.add(
            'polling',
            sequence ? { sequence } : {},
            {
                jobId: `polling-${sequence ?? 'bootstrap'}-${Date.now()}`,
                delay,
                removeOnComplete: 10,
                attempts: 1,
                removeOnFail: {
                    age: 3600,
                },
            },
        );
    }

    public static getInstance(client?: Client) {
        if (!this.instance && client) {
            this.instance = new ZKillSubscriber(client);
        }
        else if (!this.instance) {
            throw new Error('Instance needs to be created with a client once.');
        }

        return this.instance;
    }

    public async subscribe(subType: SubscriptionType, guildId: string, channel: string, id?: number, minValue = 0, limitType: LimitType = LimitType.NONE, limitIds?: string, killType?: KillType) {
        try {
            await SubscriptionModel.findOneAndUpdate(
                { guildId, channelId: channel, ident: `${subType}${id ?? ''}` },
                { guildId, channelId: channel, ident: `${subType}${id ?? ''}`, subType, entityId: id, minValue, limitType, limitIds, killType },
                { upsert: true, returnDocument: 'after' },
            );
        }
        catch (error) {
            console.error('Failed to save subscription to MongoDB:', error);
        }
    }

    public async unsubscribe(subType: SubscriptionType, guildId: string, channel: string, id?: number) {
        console.log(`[Unsubscribe] subType=${subType} guildId=${guildId} channelId=${channel} id=${id ?? 'none'}\n${new Error().stack}`);
        try {
            if (subType === SubscriptionType.ALL) {
                const result = await SubscriptionModel.deleteMany({ guildId, channelId: channel });
                console.log(`[Unsubscribe] Deleted ${result.deletedCount} subscription(s) for channel ${channel} in guild ${guildId}`);
            }
            else {
                const result = await SubscriptionModel.deleteOne({ guildId, channelId: channel, ident: `${subType}${id ?? ''}` });
                console.log(`[Unsubscribe] Deleted ${result.deletedCount} subscription(s) with ident=${subType}${id ?? ''} in guild ${guildId}`);
            }
        }
        catch (error) {
            console.error('Failed to delete subscription from MongoDB:', error);
        }
    }

    public async unsubscribeGuild(guildId: string) {
        console.log(`[UnsubscribeGuild] guildId=${guildId}\n${new Error().stack}`);
        try {
            const result = await SubscriptionModel.deleteMany({ guildId });
            console.log(`[UnsubscribeGuild] Deleted ${result.deletedCount} subscription(s) for guild ${guildId}`);
        }
        catch (error) {
            console.error('Failed to delete guild subscriptions from MongoDB:', error);
        }
    }

    public async getChannelSubscriptions(guildId: string, channelId: string): Promise<Subscription[]> {
        try {
            const docs = await SubscriptionModel.find({ guildId, channelId }).lean();
            return docs.map(doc => ({
                subType: doc.subType as SubscriptionType,
                id: doc.entityId,
                minValue: doc.minValue,
                limitType: (doc.limitType ?? 'none') as LimitType,
                limitIds: doc.limitIds,
                killType: doc.killType as KillType | undefined,
            }));
        }
        catch (error) {
            console.error('Failed to fetch channel subscriptions from MongoDB:', error);
            return [];
        }
    }

    private async migrateFromJsonFiles(): Promise<void> {
        try {
            const count = await SubscriptionModel.countDocuments();
            if (count > 0) {
                return;
            }

            const configDir = './config';
            if (!fs.existsSync(configDir)) {
                return;
            }

            const jsonFiles = fs.readdirSync(configDir, { withFileTypes: true })
                .filter(f => f.isFile() && /^\d+\.json$/.test(f.name));

            if (jsonFiles.length === 0) {
                return;
            }

            console.log(`[Migration] Found ${jsonFiles.length} guild JSON file(s) — importing into MongoDB...`);

            const bulkOps: Parameters<typeof SubscriptionModel.bulkWrite>[0] = [];
            let totalSubscriptions = 0;
            let skippedFiles = 0;

            for (const file of jsonFiles) {
                const guildIdMatch = file.name.match(/^(\d+)\.json$/);
                if (!guildIdMatch) continue;
                const guildId = guildIdMatch[1];

                try {
                    const raw = fs.readFileSync(path.join(configDir, file.name), 'utf8');
                    const parsed = JSON.parse(raw);

                    if (!parsed.channels || typeof parsed.channels !== 'object') {
                        skippedFiles++;
                        continue;
                    }

                    for (const [channelId, channelData] of Object.entries(parsed.channels as Record<string, any>)) {
                        if (!channelData?.subscriptions || typeof channelData.subscriptions !== 'object') continue;

                        for (const [ident, subData] of Object.entries(channelData.subscriptions as Record<string, any>)) {
                            if (!subData?.subType) continue;

                            bulkOps.push({
                                updateOne: {
                                    filter: { guildId, channelId, ident },
                                    update: {
                                        $set: {
                                            guildId, channelId, ident,
                                            subType: subData.subType,
                                            entityId: subData.id ?? undefined,
                                            minValue: subData.minValue ?? 0,
                                            limitType: subData.limitType ?? 'none',
                                            limitIds: subData.limitIds ?? undefined,
                                            killType: subData.killType ?? undefined,
                                        },
                                    },
                                    upsert: true,
                                },
                            });
                            totalSubscriptions++;
                        }
                    }
                }
                catch (fileError) {
                    console.error(`[Migration] Failed to parse guild file ${file.name}:`, fileError);
                    skippedFiles++;
                }
            }

            if (bulkOps.length > 0) {
                const BATCH_SIZE = 500;
                for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
                    await SubscriptionModel.bulkWrite(bulkOps.slice(i, i + BATCH_SIZE), { ordered: false });
                }
            }

            console.log(`[Migration] Complete: ${totalSubscriptions} subscription(s) from ${jsonFiles.length - skippedFiles} guild(s) imported.${skippedFiles > 0 ? ` (${skippedFiles} file(s) skipped due to errors)` : ''}`);
        }
        catch (error) {
            console.error('[Migration] Failed to migrate JSON subscriptions to MongoDB:', error);
        }
    }

    getDoClient(): Client {
        return this.doClient;
    }
}
