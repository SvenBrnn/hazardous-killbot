import { IZkillPoll, IZkill } from '../interfaces/zkill';

export function transformKill(kill: IZkillPoll) : IZkill {
    return {
        attackers: kill.killmail.attackers,
        killmail_id: kill.killmail.killmail_id,
        killmail_time: kill.killmail.killmail_time,
        solar_system_id: kill.killmail.solar_system_id,
        victim: kill.killmail.victim,
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
            url: kill.zkb.url,
            labels: kill.zkb.labels,
            href: kill.zkb.href,
        },
    };
}