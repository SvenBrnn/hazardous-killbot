import { EsiClient } from './esiClient';
import { IESIKillmail, IZkillPoll } from '../interfaces/zkill';

const ENABLE_KILLS_RESOLVER_LOG = false; // Set to true to enable logging

function log(...args: any[]) {
    if (ENABLE_KILLS_RESOLVER_LOG) {
        console.log('[KillResolver]', ...args);
    }
}

export class KillResolver {
    protected static instance: KillResolver;

    public static getInstance(): KillResolver {
        if (!KillResolver.instance) {
            KillResolver.instance = new KillResolver();
        }
        return KillResolver.instance;
    }

    public async resolveKill(kill: IZkillPoll): Promise<IESIKillmail | undefined> {
        log('Resolving kill:', kill);
        const esiClient = EsiClient.getInstance();
        log('Fetching killmail from ESI for href:', kill.zkb.href);
        return await esiClient.getKillmailFromESIByUrl(kill.zkb.href || `https://esi.evetech.net/killmails/${kill.killID}/${kill.zkb.hash}/`);
    }
}