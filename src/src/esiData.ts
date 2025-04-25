import * as fs from 'fs';
import * as path from 'path';
// If using Node.js 18+, you can use the built-in fetch. Otherwise, install node-fetch and uncomment the next line:
// import fetch from 'node-fetch';
import { SubscriptionType } from './zKillSubscriber';

const CACHE_FILE = path.resolve(__dirname, 'esiDataCache.json');

export class ESIData {
    protected static instance: ESIData;
    private cache: Map<string, string> = new Map();
    private saveScheduled = false;

    private constructor() {
        this.loadCache();
    }

    public static getInstance(): ESIData {
        if (!this.instance) {
            this.instance = new ESIData();
        }
        return this.instance;
    }

    private loadCache() {
        if (fs.existsSync(CACHE_FILE)) {
            try {
                const data = fs.readFileSync(CACHE_FILE, 'utf-8');
                const obj = JSON.parse(data);
                this.cache = new Map(Object.entries(obj));
                console.log('[ESIData] Cache loaded from disk.');
            }
            catch {
                this.cache = new Map();
                console.log('[ESIData] Failed to load cache from disk.');
            }
        }
    }

    private saveCache() {
        const obj = Object.fromEntries(this.cache);
        fs.writeFileSync(CACHE_FILE, JSON.stringify(obj), 'utf-8');
        console.log('[ESIData] Cache saved to disk.');
    }

    private scheduleSaveCache() {
        if (!this.saveScheduled) {
            this.saveScheduled = true;
            setTimeout(() => {
                this.saveCache();
                this.saveScheduled = false;
            }, 5000); // Save every 5 seconds at most
        }
    }

    public async getName(id: number, type: SubscriptionType): Promise<string | undefined> {
        const stringType = getSubscriptionTypeString(type);
        if (!stringType) {
            console.log(`[ESIData] Unknown subscription type: ${type}`);
            return undefined;
        }
        const key = `${stringType}:${id}`;
        if (this.cache.has(key)) {
            console.log(`[ESIData] Cache hit for ${key}`);
            return this.cache.get(key);
        }
        else {
            console.log(`[ESIData] Cache miss for ${key}, fetching from ESI...`);
            const esiName = await this.getNameFromESI(id, stringType);
            if (esiName) {
                this.setName(key, esiName);
                console.log(`[ESIData] Fetched and cached name for ${key}: ${esiName}`);
                return esiName;
            }
            else {
                console.log(`[ESIData] Failed to fetch name for ${key}`);
            }
        }
        return undefined;
    }

    public setName(key: string, name: string) {
        this.cache.set(key, name);
        this.scheduleSaveCache();
    }

    public async getNameFromESI(id: number, type: string): Promise<string | undefined> {
        const url = `https://esi.evetech.net/latest/${type}/${id}/?datasource=tranquility`;
        console.log(`[ESIData] Fetching from ESI: ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.log(`[ESIData] ESI response not ok for ${url}: ${response.status}`);
                return undefined;
            }
            const data = await response.json();
            console.log(`[ESIData] ESI response for ${url}:`, data);
            return data.name;
        }
        catch (error) {
            console.log(`[ESIData] Error fetching from ESI for ${url}:`, error);
            return undefined;
        }
    }
}

function getSubscriptionTypeString(type: SubscriptionType): string | undefined {
    switch (type) {
    case SubscriptionType.REGION:
        return 'universe/regions';
    case SubscriptionType.CONSTELLATION:
        return 'universe/constellations';
    case SubscriptionType.SYSTEM:
        return 'universe/systems';
    case SubscriptionType.corporation:
        return 'corporations';
    case SubscriptionType.ALLIANCE:
        return 'alliances';
    case SubscriptionType.CHARACTER:
        return 'characters';
    case SubscriptionType.GROUP:
        return 'universe/groups';
    case SubscriptionType.SHIP:
        return 'universe/types';
    default:
        console.log(`[ESIData] Unknown subscription type: ${type}`);
        return undefined;
    }
}
