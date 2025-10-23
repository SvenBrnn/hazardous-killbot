import { KillResolver } from './killResolver';
import { IZkillPoll, IZkill } from '../interfaces/zkill';

export async function transformKill(kill: IZkillPoll) : Promise<IZkill> {
    const esiKillmail = await KillResolver.getInstance().resolveKill(kill);
    if (!esiKillmail) {
        throw new Error('Failed to resolve killmail from ESI');
    }
    return {
        attackers: esiKillmail.attackers,
        killmail_id: esiKillmail.killmail_id,
        killmail_time: esiKillmail.killmail_time,
        solar_system_id: esiKillmail.solar_system_id,
        victim: esiKillmail.victim,
        zkb: {
            locationID: kill.zkb.locationID,
            hash: kill.zkb.hash,
            fittedValue: kill.zkb.fittedValue,
            droppedValue: kill.zkb.droppedValue,
            destroyedValue: kill.zkb.destroyedValue,
            totalValue: kill.zkb.totalValue,
            points: kill.zkb.points,
            npc: kill.zkb.npc,
            solo: kill.zkb.solo,
            awox: kill.zkb.awox,
            esi: kill.zkb.esi,
            //  https://zkillboard.com/kill/<killmail_id>/
            url: kill.zkb.url || `https://zkillboard.com/kill/${kill.killID}/`,
            labels: kill.zkb.labels,
            href: kill.zkb.href,
        },
    };
}