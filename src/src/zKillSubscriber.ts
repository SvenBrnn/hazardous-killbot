import { Client } from 'discord.js';
import axios from 'axios';
import cron from 'node-cron';
import { REST } from '@discordjs/rest';
import AsyncLock from 'async-lock';
import { Queue, Worker } from 'bullmq';
import * as fs from 'fs';
import { EsiClient } from './lib/esiClient';
import { sendKillMailToDiscord } from './jobs/sendKill';
import { initializeQueueDashboard } from './lib/queueDashboard';
import processKill from './jobs/processKill';
import { IZkillPoll } from './interfaces/zkill';
import { transformKill } from './lib/killTransformer';

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

interface SubscriptionGuild {
    channels: Map<string, SubscriptionChannel>
}

interface SubscriptionChannel {
    subscriptions: Map<string, Subscription>
}

export interface Subscription {
    subType: SubscriptionType
    id?: number
    minValue: number,
    limitType: LimitType
    limitIds?: string
    killType?: KillType
}

export class ZKillSubscriber {
    protected static instance: ZKillSubscriber;
    protected doClient: Client;

    protected subscriptions: Map<string, SubscriptionGuild>;
    protected ships: Map<number, number>;
    protected rest: REST;

    protected asyncLock: AsyncLock;
    protected esiClient: EsiClient;

    protected worker_polling: Worker;
    protected queue_polling: Queue;

    protected worker: Worker;
    protected queue: Queue;

    protected constructor(client: Client) {
        this.asyncLock = new AsyncLock({ maxPending: 10000 });
        this.esiClient = new EsiClient();
        this.subscriptions = new Map<string, SubscriptionGuild>();
        this.ships = new Map<number, number>();
        this.loadConfig();
        this.loadShips();

        // Initialize the polling worker
        this.worker_polling = new Worker('polling', async (job) => {
            // Run a ajax to https://zkillredisq.stream/listen.php?queueID=${env.queue_identifier}&ttw=10 using axios
            const response = await axios.get(`https://zkillredisq.stream/listen.php?queueID=${process.env.QUEUE_IDENTIFIER}&ttw=10`);
            if (response.data.package) {
                const rawData: IZkillPoll = response.data.package;
                // Transform the data to match the expected format
                const data = transformKill(rawData);
                // console.log(`Added killmail ${data.killmail_id} to the queue.`); // keep for debugging
                await this.queue.add(
                    'process-kill',
                    data,
                    {
                        jobId: 'kill-' + data.killmail_id.toString(),
                        removeOnComplete: true,
                        backoff: {
                            type: 'fixed',
                            delay: 60000, // Wait 1 minute before retrying
                        },
                        attempts: 10, // Retry 10 times
                        removeOnFail: {
                            age: 86400,
                        }, // Remove after 24 hours
                    },
                );
            }

            // add a new polling job to the queue
            await this.queue_polling.add(
                'polling',
                {
                    jobId: `polling-${Date.now()}`,
                    removeOnComplete: true,
                    backoff: {
                        type: 'fixed',
                        delay: 60000, // Wait 1 minute before retrying
                    },
                    attempts: 10, // Retry 10 times
                    removeOnFail: {
                        age: 3600, // Remove after 1 hours
                    },
                },
            );
        }, {
            connection: {
                host: 'redis',
                port: 6379,
            },
            concurrency: 1,
        });

        // Initialize the worker
        this.worker = new Worker('zkillboard', async (job) => {
            const data = job.data;
            if (job.name === 'process-kill') {
                await processKill(this, this.queue, job);
            }
            else {
                await sendKillMailToDiscord(this, data.guildId, data.channelId, data.subType, data.data, data.subId, data.messageColor);
            }
        }, {
            connection: {
                host: 'redis',
                port: 6379,
            },
            concurrency: 10,
        });

        // Initialize the polling queue
        this.queue_polling = new Queue('polling', {
            connection: {
                host: 'redis',
                port: 6379,
            },
        });

        // Initialize the queue
        this.queue = new Queue('zkillboard', {
            connection: {
                host: 'redis',
                port: 6379,
            },
        });

        // initialize the dashboard
        initializeQueueDashboard(this.queue, this.queue_polling);


        this.doClient = client;
        this.rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN || '');

        cron.schedule('* * * * *', () => this.checkPollingQueue);

        // On kill signal, make sure the workers are closed properly
        process.on('SIGINT', async () => {
            console.log('SIGINT received, closing workers...');
            await this.worker_polling.close();
            await this.worker.close();
            console.log('Workers closed.');
            process.exit(0);
        });
    }

    protected checkPollingQueue() {
        // Check if queue_polling has any jobs in running or waiting state
        this.queue_polling.getJobCounts().then((counts) => {
            if (counts.waiting == 0 || counts.active == 0) {
                console.log('Polling queue is empty, adding a new job.');
                this.queue_polling.add(
                    'polling',
                    {},
                    {
                        jobId: `polling-${Date.now()}`,
                        removeOnComplete: true,
                        backoff: {
                            type: 'fixed',
                            delay: 10, // Wait 1 minute before retrying
                        },
                        attempts: 60000, // Retry 10 times
                        removeOnFail: {
                            age: 3600, // Remove after 1 hours
                        },
                    },
                );
            }
        });
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

    public subscribe(subType: SubscriptionType, guildId: string, channel: string, id?: number, minValue = 0, limitType: LimitType = LimitType.NONE, limitIds?: string, killType?: KillType) {
        if (!this.subscriptions.has(guildId)) {
            this.subscriptions.set(guildId, { channels: new Map<string, SubscriptionChannel>() });
        }
        const guild = this.subscriptions.get(guildId);
        if (!guild?.channels.has(channel)) {
            guild?.channels.set(channel, { subscriptions: new Map<string, Subscription>() });
        }
        const guildChannel = guild?.channels.get(channel);
        const ident = `${subType}${id ? id : ''}`;
        guildChannel?.subscriptions.set(ident, { subType, id, minValue, limitType, limitIds, killType });

        fs.writeFileSync('./config/' + guildId + '.json', JSON.stringify(this.generateObject(guild)), 'utf8');
    }

    public async unsubscribe(subType: SubscriptionType, guildId: string, channel: string, id?: number) {
        if (!this.subscriptions.has(guildId)) {
            return;
        }
        const guild = this.subscriptions.get(guildId);
        if (!guild?.channels.has(channel)) {
            return;
        }
        // If unsubscribe all is triggered
        if (subType === SubscriptionType.ALL) {
            guild?.channels.delete(channel);
            fs.writeFileSync('./config/' + guildId + '.json', JSON.stringify(this.generateObject(guild)), 'utf8');
            return;
        }
        const guildChannel = guild?.channels.get(channel);
        const ident = `${subType}${id ? id : ''}`;
        if (!guildChannel?.subscriptions.has(ident)) {
            return;
        }
        guildChannel?.subscriptions.delete(ident);
        fs.writeFileSync('./config/' + guildId + '.json', JSON.stringify(this.generateObject(guild)), 'utf8');
    }

    public async unsubscribeGuild(guildId: string) {
        if (this.subscriptions.has(guildId)) {
            this.subscriptions.delete(guildId);
            fs.unlinkSync('./config/' + guildId + '.json');
            return;
        }
    }

    private generateObject(object: any): any {
        const keys = Object.keys(object);
        const newObject: any = {};
        for (const key of keys) {
            if (object[key] instanceof Map) {
                newObject[key] = this.generateObject(Object.fromEntries(object[key]));
            }
            else if (Array.isArray(object[key])) {
                newObject[key] = this.generateObject(object[key]);
            }
            else if (typeof object[key] === 'object') {
                newObject[key] = this.generateObject(object[key]);
            }
            else {
                newObject[key] = object[key];
            }
        }
        return newObject;
    }

    private loadConfig() {
        if (!fs.existsSync('./config')) {
            fs.mkdirSync('./config');
        }
        const files = fs.readdirSync('./config', { withFileTypes: true });
        for (const file of files) {
            if (file.name.match(/\d+\.json$/)) {
                const guildId = file.name.match(/(\d*)\.json$/);
                if (guildId && guildId.length > 0 && guildId[0]) {
                    const fileContent = fs.readFileSync('./config/' + file.name, 'utf8');
                    const parsedFileContent = JSON.parse(fileContent);
                    this.subscriptions.set(guildId[1], { channels: this.createChannelMap(parsedFileContent.channels) });
                }
            }
        }
    }

    private createChannelMap(object: any): Map<string, SubscriptionChannel> {
        const map = new Map<string, SubscriptionChannel>();
        const keys = Object.keys(object);
        for (const key of keys) {
            map.set(key, { subscriptions: this.createSubscriptionMap(object[key].subscriptions) });
        }
        return map;
    }

    private createSubscriptionMap(object: any): Map<string, Subscription> {
        const map = new Map<string, Subscription>();
        const keys = Object.keys(object);
        for (const key of keys) {
            if (object[key].limitType === undefined) {
                object[key].limitType = 'none';
            }
            map.set(key, object[key]);
        }
        return map;
    }

    private loadShips() {
        if (fs.existsSync('./config/ships.json')) {
            const fileContent = fs.readFileSync('./config/ships.json', 'utf8');
            const data = JSON.parse(fileContent);
            for (const key in data) {
                this.ships.set(Number.parseInt(key), data[key]);
            }
        }
    }

    getGuildSubscriptions(guildId: string): SubscriptionGuild | undefined {
        return this.subscriptions.get(guildId);
    }

    getChannelSubscriptions(guildId: string, channelId: string): SubscriptionChannel | undefined {
        const guild = this.subscriptions.get(guildId);
        return guild?.channels.get(channelId);
    }

    getAllSubscriptions(): Map<string, SubscriptionGuild> {
        return this.subscriptions;
    }

    getDoClient(): Client {
        return this.doClient;
    }
}
