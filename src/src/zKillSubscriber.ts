import {Client, TextChannel} from 'discord.js';
import {MessageEvent, WebSocket} from 'ws';
import {REST} from '@discordjs/rest';
import * as fs from 'fs';

export enum SubscriptionType {
    PUBLIC = 'public',
    CORPERATION = 'corperation',
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

export class ZKillSubscriber {
    protected static instance : ZKillSubscriber;
    protected doClient: Client;
    protected websocket: WebSocket;

    protected subscriptions: Map<string, SubscriptionGuild>;
    protected rest: REST;

    protected constructor(client: Client) {
        this.subscriptions = new Map<string, SubscriptionGuild>();
        this.loadConfig();

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
        //console.log(data);
        this.subscriptions.forEach((guild) => {
            guild.channels.forEach((channel, channelId) => {
                channel.subscriptions.forEach(async subscription => {
                    let requireSend = false;
                    if(subscription.minValue > data.zkb.totalValue) {
                        return; // Do not send if below the min value
                    }
                    switch (subscription.subType) {
                    case SubscriptionType.PUBLIC:
                        await this.sendKill(channelId, data);
                        break;
                    case SubscriptionType.ALLIANCE:
                        if (data.victim.alliance_id === subscription.id) {
                            requireSend = true;
                        }
                        if(!requireSend) {
                            for(const attacker of data.attackers) {
                                if(attacker.alliance_id === subscription.id) {
                                    requireSend = true;
                                    break;
                                }
                            }
                        }
                        if(requireSend) {
                            await this.sendKill(channelId, data);
                        }
                        break;
                    case SubscriptionType.CORPERATION:
                        if (data.victim.corporation_id === subscription.id) {
                            requireSend = true;
                        }
                        if(!requireSend) {
                            for(const attacker of data.attackers) {
                                if(attacker.corporation_id === subscription.id) {
                                    requireSend = true;
                                    break;
                                }
                            }
                        }
                        if(requireSend) {
                            await this.sendKill(channelId, data);
                        }
                        break;
                    case SubscriptionType.CHARACTER:
                        if (data.victim.character_id === subscription.id) {
                            requireSend = true;
                        }
                        if(!requireSend) {
                            for(const attacker of data.attackers) {
                                if(attacker.character_id === subscription.id) {
                                    requireSend = true;
                                    break;
                                }
                            }
                        }
                        if(requireSend) {
                            await this.sendKill(channelId, data);
                        }
                        break;
                    default:
                    }
                });
            });
        });
    }

    private async sendKill(channelId:string, data:any) {
        const c = <TextChannel>await this.doClient.channels.cache.get(channelId);
        try {
            c.send({
                content: data.zkb.url
            }
            );
        } catch (e) {
            console.log(e);
        }
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
            if(file.name.match(/\.json$/)) {
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
}