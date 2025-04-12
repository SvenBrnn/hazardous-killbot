import { Job, Queue } from 'bullmq';
import { Colors } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import MemoryCache from 'memory-cache';
import { KillType, LimitType, Subscription, SubscriptionType, ZKillSubscriber } from '../zKillSubscriber';
import { IZkill, IZkillAttacker, IZkillExtended } from '../interfaces/zkill';
import SolarSystemSchema, { ISolarSystem } from '../models/system';
import { EsiClient } from '../lib/esiClient';
import ShipsSchema, { IShips } from '../models/ships';
import CharactersSchema, { ICharacters } from '../models/characters';
import Alliances, { IAlliances } from '../models/alliances';
import Corps, { ICorps } from '../models/corps';
import Faction, { IFaction } from '../models/faction';

enum ExtendType {
    VICTIM = 'victim',
    FINAL_BLOW = 'final_blow',
    ATTACKER = 'attacker',
}

export default async (zkillSub : ZKillSubscriber, queue : Queue, job : Job) => {
    const data : IZkill = job.data;
    data.extendedVictim = await extendZkillData(data, ExtendType.VICTIM);
    data.extendedFinalBlow = await extendZkillData(data, ExtendType.FINAL_BLOW);
    data.attackers = await extendAttackersData(data);

    // Throw an error if we still don't have the data extended
    zkillSub.getAllSubscriptions().forEach((guild, guildId) => {
        guild.channels.forEach((channel, channelId) => {
            channel.subscriptions.forEach(async (subscription) => {
                if (!data.extendedVictim) {
                    throw new Error('MISSING_EXTENDED_DATA');
                }
                let color: number = Colors.Green;
                try {
                    let requireSend = false;
                    if (subscription.minValue > data.zkb.totalValue) {
                        return; // Do not send if below the min value
                    }
                    switch (subscription.subType) {
                    case SubscriptionType.PUBLIC:
                        await sendKill(queue, guildId, channelId, subscription.subType, data);
                        break;
                    case SubscriptionType.REGION:
                        if (data.extendedVictim.systemData.regionId === subscription.id) {
                            await sendKill(queue, guildId, channelId, subscription.subType, data);
                        }
                        break;
                    case SubscriptionType.CONSTELLATION:
                        if (data.extendedVictim.systemData.constellationId === subscription.id) {
                            await sendKill(queue, guildId, channelId, subscription.subType, data);
                        }
                        break;
                    case SubscriptionType.SYSTEM:
                        if (data.solar_system_id === subscription.id) {
                            await sendKill(queue, guildId, channelId, subscription.subType, data);
                        }
                        break;
                    case SubscriptionType.ALLIANCE:
                        if (data.victim.alliance_id === subscription.id) {
                            requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                            color = Colors.Red;
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
                            if (subscription.limitType !== LimitType.NONE && !await isInLimit(subscription, data.extendedVictim.systemData)) {
                                return;
                            }
                            await sendKill(queue, guildId, channelId, subscription.subType, data, subscription.id, color);
                        }
                        break;
                    case SubscriptionType.corporation:
                        if (data.victim.corporation_id === subscription.id) {
                            requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                            color = Colors.Red;
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
                            if (subscription.limitType !== LimitType.NONE && !await isInLimit(subscription, data.extendedVictim.systemData)) {
                                return;
                            }
                            await sendKill(queue, guildId, channelId, subscription.subType, data, subscription.id, color);
                        }
                        break;
                    case SubscriptionType.CHARACTER:
                        if (data.victim.character_id === subscription.id) {
                            requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                            color = Colors.Red;
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
                            if (subscription.limitType !== LimitType.NONE && !await isInLimit(subscription, data.extendedVictim.systemData)) {
                                return;
                            }
                            await sendKill(queue, guildId, channelId, subscription.subType, data, subscription.id, color);
                        }
                        break;
                    case SubscriptionType.GROUP:
                        if (data.victim.ship_type_id) {
                            if (data.extendedVictim.ship?.group === subscription.id) {
                                requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                                color = Colors.Red;
                            }
                        }
                        if (!requireSend) {
                            for (const attacker of data.attackers) {
                                if (attacker.ship_type_id) {
                                    if (attacker.ship?.group === subscription.id) {
                                        requireSend = subscription.killType === KillType.KILLS || subscription.killType === undefined;
                                        break;
                                    }
                                }
                            }
                        }
                        if (requireSend) {
                            if (subscription.limitType !== LimitType.NONE && !await isInLimit(subscription, data.extendedVictim.systemData)) {
                                return;
                            }
                            await sendKill(queue, guildId, channelId, subscription.subType, data, subscription.id, color);
                        }
                        break;
                    case SubscriptionType.SHIP:
                        if (data.victim.ship_type_id) {
                            if (data.victim.ship_type_id === subscription.id) {
                                requireSend = subscription.killType === KillType.LOSSES || subscription.killType === undefined;
                                color = Colors.Red;
                            }
                        }
                        if (!requireSend) {
                            for (const attacker of data.attackers) {
                                if (attacker.ship_type_id) {
                                    if (attacker.ship_type_id === subscription.id) {
                                        requireSend = subscription.killType === KillType.KILLS || subscription.killType === undefined;
                                        break;
                                    }
                                }
                            }
                        }
                        if (requireSend) {
                            if (subscription.limitType !== LimitType.NONE && !await isInLimit(subscription, data.extendedVictim.systemData)) {
                                return;
                            }
                            await sendKill(queue, guildId, channelId, subscription.subType, data, subscription.id, color);
                        }
                        break;
                    default:
                    }
                }
                catch (e) {
                    console.log(e);
                }
            });
        });
    });
};

// Global lock set to prevent race conditions
const sendKillLocks = new Set<string>();

async function sendKill(queue : Queue, guildId: string, channelId: string, subType: SubscriptionType, data: IZkill, subId?: number, messageColor: number = Colors.Grey) {
    const cacheKey = `${channelId}_${data.killmail_id}_queued`;
    const cache = MemoryCache.get(cacheKey);

    // If already queued, do not queue the same killmail to the same channel again
    if (cache) {
        return;
    }

    // Check if a lock exists for this key
    if (sendKillLocks.has(cacheKey)) {
        return; // Another process is already handling this killmail for this channel
    }

    // Acquire the lock
    sendKillLocks.add(cacheKey);

    try {
        await queue.add(
            'zkillboard',
            { guildId, channelId, subType, data, subId, messageColor },
            {
                jobId: uuidv4(),
                removeOnComplete: {
                    age: 300,
                }, // Automatically remove the job after 30 seconds
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

        MemoryCache.put(`${channelId}_${data.killmail_id}_queued`, 'queued', 60000); // Prevent from sending again, cache it for 1 min
    }
    finally {
        // Release the lock
        sendKillLocks.delete(cacheKey);
    }
}

async function extendZkillData(data: IZkill, extendType : ExtendType) : Promise<IZkillExtended> {
    if (extendType === ExtendType.VICTIM) {
        const { alliance, character, corporation } = await getCharacterData(data.victim.corporation_id, data.victim.character_id, data.victim.alliance_id, data.victim.faction_id);
        return {
            alliance: alliance,
            character: character,
            corporation: corporation,
            ship: await getShipData(data.victim.ship_type_id),
            systemData: await getSystemData(data.solar_system_id),
        };
    }
    else {
        const finalBlow = data.attackers.find((attacker) => attacker.final_blow);
        if (!finalBlow) {
            throw new Error('NO_FINAL_BLOW');
        }
        // Attacker can have no data then re just return undefined
        if (!finalBlow.corporation_id && !finalBlow.character_id && !finalBlow.alliance_id && !finalBlow.faction_id && !finalBlow.ship_type_id) {
            return {
                systemData: await getSystemData(data.solar_system_id),
            };
        }

        const { alliance, character, corporation } = await getCharacterData(finalBlow.corporation_id, finalBlow.character_id, finalBlow.alliance_id);
        return {
            alliance: alliance,
            character: character,
            corporation: corporation,
            ship: await getShipData(finalBlow.ship_type_id),
            systemData: await getSystemData(data.solar_system_id),
        };
    }
}

async function extendAttackersData(data: IZkill) : Promise<IZkillAttacker[]> {
    const attackers = data.attackers;
    // Extend ship data for all attackers
    for (const attacker of attackers) {
        if (attacker.ship_type_id === undefined) {
            continue;
        }
        attacker.ship = await getShipData(attacker.ship_type_id);
    }
    return attackers;
}

async function isInLimit(subscription: Subscription, systemData: ISolarSystem): Promise<boolean> {
    const limit = subscription.limitIds?.split(',') || [];
    if (subscription.limitType === LimitType.SYSTEM && limit.indexOf(systemData.id.toString()) !== -1) {
        return true;
    }
    if (subscription.limitType === LimitType.CONSTELLATION && limit.indexOf(systemData.constellationId.toString()) !== -1) {
        return true;
    }
    return subscription.limitType === LimitType.REGION && limit.indexOf(systemData.regionId.toString()) !== -1;
}

async function getSystemData(systemId: number): Promise<ISolarSystem> {
    let system: ISolarSystem | null = await SolarSystemSchema.findOne({
        eveId: systemId,
    });
    if (system) {
        return system;
    }
    system = await EsiClient.getInstance().getSystemInfo(systemId);
    return system;
}

async function getShipData(shipId: number): Promise<IShips> {
    let ship : IShips | null = await ShipsSchema.findOne({
        eveId: shipId,
    });
    if (ship && ship.group) {
        return ship;
    }
    ship = await EsiClient.getInstance().getTypeGroupId(shipId);

    return ship;
}

async function getCharacterData(corporation_id?: number, character_id?: number, alliance_id?: number, factionId?: number) : Promise<{ character?: ICharacters, corporation?: ICorps, alliance?: IAlliances, faction?: IFaction }> {
    const missingIds: number[] = [];
    let character: ICharacters | null = null;
    if (character_id !== undefined) {
        character = await CharactersSchema.findOne({
            eveId: character_id,
        });
        if (!character) {
            missingIds.push(character_id);
        }
    }
    let corporation: ICorps | null = null;
    if (corporation_id !== undefined) {
        corporation = await Corps.findOne({
            eveId: corporation_id,
        });
        if (!corporation) {
            missingIds.push(corporation_id);
        }
    }
    let alliance: IAlliances | null = null;
    if (alliance_id !== undefined) {
        alliance = await Alliances.findOne({
            eveId: alliance_id,
        });
        if (!alliance) {
            missingIds.push(alliance_id);
        }
    }
    let faction: IFaction | null = null;
    if (factionId !== undefined) {
        faction = await Faction.findOne({
            eveId: factionId,
        });
        if (!faction) {
            missingIds.push(factionId);
        }
    }


    if (missingIds.length > 0) {
        const missingData = await EsiClient.getInstance().getCharacterData(missingIds);
        for (const data of missingData) {
            if (data.category === 'character') {
                character = await CharactersSchema.create({
                    eveId: data.id,
                    name: data.name,
                });
            }
            if (data.category === 'corporation') {
                corporation = await Corps.create({
                    eveId: data.id,
                    name: data.name,
                });
            }
            if (data.category === 'alliance') {
                alliance = await Alliances.create({
                    eveId: data.id,
                    name: data.name,
                });
            }
            if (data.category === 'faction') {
                faction = await Faction.create({
                    eveId: data.id,
                    name: data.name,
                });
            }
        }
    }
    const ret: { character?: ICharacters, corporation?: ICorps, alliance?: IAlliances, faction?: IFaction } = { };
    if (faction) {
        ret.faction = faction;
    }
    if (corporation) {
        ret.corporation = corporation;
    }
    if (character) {
        ret.character = character;
    }
    if (alliance) {
        ret.alliance = alliance;
    }

    return ret;
}