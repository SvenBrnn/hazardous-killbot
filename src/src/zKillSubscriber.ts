import {Client, DiscordAPIError, TextChannel} from 'discord.js';
import {MessageEvent, WebSocket} from 'ws';
import {REST} from '@discordjs/rest';
import AsyncLock from 'async-lock';
import MemoryCache from 'memory-cache';
import * as fs from 'fs';
import {EsiClient} from './lib/esiClient';

export enum SubscriptionType {
    ALL = 'all',
    PUBLIC = 'public',
    REGION = 'region',
    CONSTELLATION = 'constellation',
    SYSTEM = 'system',
    corporation = 'corporation',
    ALLIANCE = 'alliance',
    CHARACTER = 'character'
}

interface SubscriptionGuild {
    channels: Map<string, SubscriptionChannel>
}

interface SubscriptionChannel {
    subscriptions: Map<string, Subscription>
}

interface Subscription {
    subType: SubscriptionType
    id?: number
    minValue: number
}

export interface SolarSystem {
    id: number
    regionId: number
    regionName: string
    constellationId: number
    constellationName: string
}

export class ZKillSubscriber {
    protected static instance : ZKillSubscriber;
    protected doClient: Client;
    protected websocket: WebSocket;

    protected subscriptions: Map<string, SubscriptionGuild>;
    protected systems: Map<number, SolarSystem>;
    protected rest: REST;

    protected asyncLock: AsyncLock;
    protected esiClient: EsiClient;

    protected constructor(client: Client) {
        this.asyncLock = new AsyncLock();
        this.esiClient = new EsiClient();
        this.subscriptions = new Map<string, SubscriptionGuild>();
        this.systems = new Map<number, SolarSystem>();
        this.loadConfig();
        this.loadSystems();

        this.doClient = client;
        this.rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN || '');

        this.websocket = new WebSocket('wss://zkillboard.com/websocket/');
        this.websocket.onmessage = this.onMessage.bind(this);

        this.websocket.onopen = () => {
            this.websocket.send(JSON.stringify({
                'action':'sub',
                'channel': 'killstream'
            }));
        };
        this.websocket.onclose = () => {
            process.exit(0);
        };
    }

    protected async onMessage (event: MessageEvent) {
        const data = JSON.parse(event.data.toString());
        this.subscriptions.forEach((guild, guildId) => {
            guild.channels.forEach((channel, channelId) => {
                channel.subscriptions.forEach(async (subscription) => {
                    try {
                        let requireSend = false, systemData = null;
                        if (subscription.minValue > data.zkb.totalValue) {
                            return; // Do not send if below the min value
                        }
                        switch (subscription.subType) {
                        case SubscriptionType.PUBLIC:
                            await this.sendKill(guildId, channelId, subscription.subType, data);
                            break;
                        case SubscriptionType.REGION:
                            systemData = await this.getSystemData(data.solar_system_id);
                            if (systemData.regionId === subscription.id) {
                                await this.sendKill(guildId, channelId, subscription.subType, data);
                            }
                            break;
                        case SubscriptionType.CONSTELLATION:
                            systemData = await this.getSystemData(data.solar_system_id);
                            if (systemData.constellationId === subscription.id) {
                                await this.sendKill(guildId, channelId, subscription.subType, data);
                            }
                            break;
                        case SubscriptionType.SYSTEM:
                            if (data.solar_system_id === subscription.id) {
                                await this.sendKill(guildId, channelId, subscription.subType, data);
                            }
                            break;
                        case SubscriptionType.ALLIANCE:
                            if (data.victim.alliance_id === subscription.id) {
                                requireSend = true;
                            }
                            if (!requireSend) {
                                for (const attacker of data.attackers) {
                                    if (attacker.alliance_id === subscription.id) {
                                        requireSend = true;
                                        break;
                                    }
                                }
                            }
                            if (requireSend) {
                                await this.sendKill(guildId, channelId, subscription.subType, data, subscription.id);
                            }
                            break;
                        case SubscriptionType.corporation:
                            if (data.victim.corporation_id === subscription.id) {
                                requireSend = true;
                            }
                            if (!requireSend) {
                                for (const attacker of data.attackers) {
                                    if (attacker.corporation_id === subscription.id) {
                                        requireSend = true;
                                        break;
                                    }
                                }
                            }
                            if (requireSend) {
                                await this.sendKill(guildId, channelId, subscription.subType, data, subscription.id);
                            }
                            break;
                        case SubscriptionType.CHARACTER:
                            if (data.victim.character_id === subscription.id) {
                                requireSend = true;
                            }
                            if (!requireSend) {
                                for (const attacker of data.attackers) {
                                    if (attacker.character_id === subscription.id) {
                                        requireSend = true;
                                        break;
                                    }
                                }
                            }
                            if (requireSend) {
                                await this.sendKill(guildId, channelId, subscription.subType, data, subscription.id);
                            }
                            break;
                        default:
                        }
                    } catch (e) {
                        console.log(e);
                    }
                });
            });
        });
    }

    private async sendKill(guildId: string, channelId:string, subType: SubscriptionType, data:any, subId?: number) {
        await this.asyncLock.acquire('sendKill', async (done) => {
            const cache = MemoryCache.get(`${channelId}_${data.killmail_id}`);
            // Mail was already send, prevent from sending twice
            if(cache) {
                done();
                return;
            }
            const c = <TextChannel>await this.doClient.channels.cache.get(channelId);
            if(c) {
                try {
                    await c.send(
                        {
                            content: data.zkb.url
                        }
                    );
                    MemoryCache.put(`${channelId}_${data.killmail_id}`, 'send', 60000); // Prevent from sending again, cache it for 1 min
                } catch (e) {
                    if (e instanceof DiscordAPIError && e.httpStatus === 403) {
                        try {
                            const owner = await c.guild.fetchOwner();
                            await owner.send(`The bot unsubscribed from channel ${c.name} on ${c.guild.name} because it was not able to write in it! Fix the permissions and subscribe again!`);
                            console.log(`Sent message to owner of ${c.guild.name} to notify him/her about the permission problem.`);
                        } catch (e) {
                            console.log(e);
                        }
                        const subscriptionsInChannel = this.subscriptions.get(guildId)?.channels.get(channelId);
                        if(subscriptionsInChannel) {
                            // Unsubscribe all events from channel
                            subscriptionsInChannel.subscriptions.forEach((subscription) => {
                                this.unsubscribe(subscription.subType, guildId, channelId, subscription.id);
                            });
                        }
                    } else {
                        console.log(e);
                    }
                }
            } else {
                await this.unsubscribe(subType, guildId, channelId, subId);
            }
            done();
        });

    }

    public static getInstance(client?: Client) {
        if(!this.instance && client)
            this.instance = new ZKillSubscriber(client);
        else if (!this.instance) {
            throw new Error('Instance needs to be created with a client once.');
        }

        return this.instance;
    }

    public subscribe(subType: SubscriptionType, guildId: string, channel: string, id?: number, minValue = 0) {
        if(!this.subscriptions.has(guildId)) {
            this.subscriptions.set(guildId, {channels: new Map<string, SubscriptionChannel>()});
        }
        const guild = this.subscriptions.get(guildId);
        if(!guild?.channels.has(channel)) {
            guild?.channels.set(channel, {subscriptions: new Map<string, Subscription>()});
        }
        const guildChannel = guild?.channels.get(channel);
        const ident = `${subType}${id?id:''}`;
        if(!guildChannel?.subscriptions.has(ident)) {
            guildChannel?.subscriptions.set(ident, {subType, id, minValue});
        }
        fs.writeFileSync('./config/' + guildId + '.json', JSON.stringify(this.generateObject(guild)), 'utf8');
    }

    public async unsubscribe(subType: SubscriptionType, guildId: string, channel: string, id?: number) {
        if(!this.subscriptions.has(guildId)) {
            return;
        }
        const guild = this.subscriptions.get(guildId);
        if(!guild?.channels.has(channel)) {
            return;
        }
        // If unsubscribe all is triggered
        if(subType === SubscriptionType.ALL) {
            !guild?.channels.delete(channel);
            fs.writeFileSync('./config/' + guildId + '.json', JSON.stringify(this.generateObject(guild)), 'utf8');
            return;
        }
        const guildChannel = guild.channels.get(channel);
        const ident = `${subType}${id?id:''}`;
        if(!guildChannel?.subscriptions.has(ident)) {
            return;
        }
        guildChannel.subscriptions.delete(ident);
        fs.writeFileSync('./config/' + guildId + '.json', JSON.stringify(this.generateObject(guild)), 'utf8');
    }

    public async unsubscribeGuild (guildId: string) {
        if(this.subscriptions.has(guildId)) {
            this.subscriptions.delete(guildId);
            fs.unlinkSync('./config/' + guildId + '.json');
            return;
        }
    }

    private generateObject (object: any): any {
        const keys = Object.keys(object);
        const newObject: any = {};
        for(const key of keys) {
            if(object[key] instanceof Map) {
                newObject[key] = this.generateObject(Object.fromEntries(object[key]));
            } else if(Array.isArray(object[key])) {
                newObject[key] = this.generateObject(object[key]);
            } else if(typeof object[key] === 'object') {
                newObject[key] = this.generateObject(object[key]);
            } else {
                newObject[key] = object[key];
            }
        }
        return newObject;
    }

    private loadConfig() {
        const files = fs.readdirSync('./config', {withFileTypes: true});
        for (const file of files) {
            if(file.name.match(/\d+\.json$/)) {
                const guildId = file.name.match(/(\d*)\.json$/);
                if(guildId && guildId.length > 0 && guildId[0]) {
                    const fileContent = fs.readFileSync('./config/' + file.name, 'utf8');
                    this.subscriptions.set(guildId[1], {channels: this.createChannelMap(JSON.parse(fileContent).channels)});
                }
            }
        }
    }

    private createChannelMap(object: any): Map<string, SubscriptionChannel> {
        const map = new Map<string, SubscriptionChannel>();
        const keys = Object.keys(object);
        for(const key of keys) {
            map.set(key, {subscriptions: this.createSubscriptionMap(object[key].subscriptions)});
        }
        return map;
    }

    private createSubscriptionMap(object: any): Map<string, Subscription> {
        const map = new Map<string, Subscription>();
        const keys = Object.keys(object);
        for(const key of keys) {
            map.set(key, object[key]);
        }
        return map;
    }

    private async getSystemData(systemId: number): Promise<SolarSystem> {
        return await this.asyncLock.acquire('fetchSystem', async (done) => {

            let system = this.systems.get(systemId);
            if (system) {
                done(undefined, system);
                return;
            }
            system = await this.esiClient.getSystemInfo(systemId);
            this.systems.set(systemId, system);
            fs.writeFileSync('./config/systems.json', JSON.stringify(Object.fromEntries(this.systems)), 'utf8');

            done(undefined, system);
        });
    }

    private loadSystems() {
        const fileContent = fs.readFileSync('./config/systems.json', 'utf8');
        const data = JSON.parse(fileContent);
        for(const key in data) {
            this.systems.set(Number.parseInt(key), data[key] as SolarSystem);
        }
    }
}