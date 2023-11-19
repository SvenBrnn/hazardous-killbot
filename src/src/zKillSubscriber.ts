import {Client, ColorResolvable, DiscordAPIError, MessageOptions, TextChannel} from 'discord.js';
import {MessageEvent, WebSocket} from 'ws';
import {REST} from '@discordjs/rest';
import AsyncLock from 'async-lock';
import MemoryCache from 'memory-cache';
import ogs from 'open-graph-scraper';
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
    CHARACTER = 'character',
    GROUP = 'group',
    SHIP = 'ship'
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

interface Subscription {
    subType: SubscriptionType
    id?: number
    minValue: number,
    limitType: LimitType
    limitIds?: string
    killType?: KillType
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

    protected subscriptions: Map<string, SubscriptionGuild>;
    protected systems: Map<number, SolarSystem>;
    protected ships: Map<number, number>;
    protected rest: REST;

    protected asyncLock: AsyncLock;
    protected esiClient: EsiClient;

    protected constructor(client: Client) {
        this.asyncLock = new AsyncLock();
        this.esiClient = new EsiClient();
        this.subscriptions = new Map<string, SubscriptionGuild>();
        this.systems = new Map<number, SolarSystem>();
        this.ships = new Map<number, number>();
        this.loadConfig();
        this.loadSystems();
        this.loadShips();

        this.doClient = client;
        this.rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN || '');
        this.connect(this, client);
    }

    private connect(sub: ZKillSubscriber, client: Client) {
        const websocket = new WebSocket('wss://zkillboard.com/websocket/');
        websocket.onmessage = sub.onMessage.bind(sub);

        websocket.onopen = () => {
            websocket.send(JSON.stringify({
                'action':'sub',
                'channel': 'killstream'
            }));
        };
        websocket.onclose = (e : any) => {
            console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
            setTimeout(function() {
                ZKillSubscriber.getInstance(client).connect(sub, client);
            }, 1000);
        };
        websocket.onerror = (error: any) => {
            console.error('Socket encountered error: ', error.message, 'Closing socket');
            websocket.close();
        };
    }

    protected async onMessage (event: MessageEvent) {
        const data = JSON.parse(event.data.toString());
        this.subscriptions.forEach((guild, guildId) => {
            guild.channels.forEach((channel, channelId) => {
                channel.subscriptions.forEach(async (subscription) => {
                    let color : ColorResolvable = 'GREEN';
                    try {
                        let requireSend = false, systemData = null, groupId = null;
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
                                requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                                color = 'RED';
                            }
                            if (!requireSend) {
                                for (const attacker of data.attackers) {
                                    if (attacker.alliance_id === subscription.id) {
                                        requireSend = subscription.killType === KillType.KILLS || subscription.killType === undefined;
                                        break;
                                    }
                                }
                            }
                            if (requireSend) {
                                if(subscription.limitType !== LimitType.NONE && !await this.isInLimit(subscription, data.solar_system_id)) {
                                    return;
                                }
                                await this.sendKill(guildId, channelId, subscription.subType, data, subscription.id, color);
                            }
                            break;
                        case SubscriptionType.corporation:
                            if (data.victim.corporation_id === subscription.id) {
                                requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                                color = 'RED';
                            }
                            if (!requireSend) {
                                for (const attacker of data.attackers) {
                                    if (attacker.corporation_id === subscription.id) {
                                        requireSend = subscription.killType === KillType.KILLS || subscription.killType === undefined;
                                        break;
                                    }
                                }
                            }
                            if (requireSend) {
                                if(subscription.limitType !== LimitType.NONE && !await this.isInLimit(subscription, data.solar_system_id)) {
                                    return;
                                }
                                await this.sendKill(guildId, channelId, subscription.subType, data, subscription.id, color);
                            }
                            break;
                        case SubscriptionType.CHARACTER:
                            if (data.victim.character_id === subscription.id) {
                                requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                                color = 'RED';
                            }
                            if (!requireSend) {
                                for (const attacker of data.attackers) {
                                    if (attacker.character_id === subscription.id) {
                                        requireSend = subscription.killType === KillType.KILLS || subscription.killType === undefined;
                                        break;
                                    }
                                }
                            }
                            if (requireSend) {
                                if(subscription.limitType !== LimitType.NONE && !await this.isInLimit(subscription, data.solar_system_id)) {
                                    return;
                                }
                                await this.sendKill(guildId, channelId, subscription.subType, data, subscription.id, color);
                            }
                            break;
                        case SubscriptionType.GROUP:
                            if(data.victim.ship_type_id) {
                                groupId = await this.getShipGroup(data.victim.ship_type_id);
                                if (groupId === subscription.id) {
                                    requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                                    color = 'RED';
                                }
                            }
                            if (!requireSend) {
                                for (const attacker of data.attackers) {
                                    if(attacker.ship_type_id) {
                                        groupId = await this.getShipGroup(attacker.ship_type_id);
                                        if (groupId === subscription.id) {
                                            requireSend = subscription.killType === KillType.KILLS || subscription.killType === undefined;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (requireSend) {
                                if(subscription.limitType !== LimitType.NONE && !await this.isInLimit(subscription, data.solar_system_id)) {
                                    return;
                                }
                                await this.sendKill(guildId, channelId, subscription.subType, data, subscription.id, color);
                            }
                            break;
                        case SubscriptionType.SHIP:
                            if(data.victim.ship_type_id) {
                                if (data.victim.ship_type_id === subscription.id) {
                                    requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                                    color = 'RED';
                                }
                            }
                            if (!requireSend) {
                                for (const attacker of data.attackers) {
                                    if(attacker.ship_type_id) {
                                        if (attacker.ship_type_id === subscription.id) {
                                            requireSend = subscription.killType === KillType.KILLS || subscription.killType === undefined;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (requireSend) {
                                if(subscription.limitType !== LimitType.NONE && !await this.isInLimit(subscription, data.solar_system_id)) {
                                    return;
                                }
                                await this.sendKill(guildId, channelId, subscription.subType, data, subscription.id, color);
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

    private async sendKill(guildId: string, channelId:string, subType: SubscriptionType, data:any, subId?: number, messageColor: ColorResolvable = 'GREY') {
        await this.asyncLock.acquire('sendKill', async (done) => {
            const cache = MemoryCache.get(`${channelId}_${data.killmail_id}`);
            // Mail was already send, prevent from sending twice
            if(cache) {
                done();
                return;
            }
            const c = <TextChannel>await this.doClient.channels.cache.get(channelId);
            if(c) {
                let embedding = null;
                try {
                    embedding = await ogs({url: data.zkb.url});
                } catch (e) {
                    // Do nothing
                }
                try {
                    const content : MessageOptions = {};
                    if(embedding?.error === false) {
                        content.embeds = [{
                            title: embedding?.result.ogTitle,
                            description: embedding?.result.ogDescription,
                            thumbnail: {
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                url: embedding?.result.ogImage?.url,
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                height: embedding?.result.ogImage?.height,
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                width: embedding?.result.ogImage?.width
                            },
                            url: data.zkb.url,
                            color: messageColor
                        }];
                    } else {
                        content.content = data.zkb.url;
                    }
                    await c.send(
                        content
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

    public subscribe(subType: SubscriptionType, guildId: string, channel: string, id?: number, minValue = 0, limitType: LimitType = LimitType.NONE, limitIds?: string, killType?: KillType) {
        if(!this.subscriptions.has(guildId)) {
            this.subscriptions.set(guildId, {channels: new Map<string, SubscriptionChannel>()});
        }
        const guild = this.subscriptions.get(guildId);
        if(!guild?.channels.has(channel)) {
            guild?.channels.set(channel, {subscriptions: new Map<string, Subscription>()});
        }
        const guildChannel = guild?.channels.get(channel);
        const ident = `${subType}${id?id:''}`;
        guildChannel?.subscriptions.set(ident, {subType, id, minValue, limitType, limitIds, killType});

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
                    const parsedFileContent = JSON.parse(fileContent);
                    this.subscriptions.set(guildId[1], {channels: this.createChannelMap(parsedFileContent.channels)});
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
            if(object[key].limitType === undefined) {
                object[key].limitType = 'none';
            }
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

    private async getShipGroup(shipId: number): Promise<number> {
        return await this.asyncLock.acquire('fetchShip', async (done) => {

            let group = this.ships.get(shipId);
            if (group) {
                done(undefined, group);
                return;
            }
            group = await this.esiClient.getTypeGroupId(shipId);
            this.ships.set(shipId, group);
            fs.writeFileSync('./config/ships.json', JSON.stringify(Object.fromEntries(this.ships)), 'utf8');

            done(undefined, group);
        });
    }

    private loadSystems() {
        if(fs.existsSync('./config/systems.json')) {
            const fileContent = fs.readFileSync('./config/systems.json', 'utf8');
            const data = JSON.parse(fileContent);
            for (const key in data) {
                this.systems.set(Number.parseInt(key), data[key] as SolarSystem);
            }
        }
    }

    private loadShips() {
        if(fs.existsSync('./config/ships.json')) {
            const fileContent = fs.readFileSync('./config/ships.json', 'utf8');
            const data = JSON.parse(fileContent);
            for (const key in data) {
                this.ships.set(Number.parseInt(key), data[key]);
            }
        }
    }

    private async isInLimit(subscription: Subscription, solar_system_id: number) {
        const systemData = await this.getSystemData(solar_system_id);
        const limit = subscription.limitIds?.split(',') || [];
        if (subscription.limitType === LimitType.SYSTEM && limit.indexOf(systemData.id.toString()) !==  -1) {
            return true;
        }
        if (subscription.limitType === LimitType.CONSTELLATION && limit.indexOf(systemData.constellationId.toString()) !==  -1) {
            return true;
        }
        return subscription.limitType === LimitType.REGION && limit.indexOf(systemData.regionId.toString()) !==  -1;
    }
}