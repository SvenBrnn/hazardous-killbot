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
            }
            catch {
                this.cache = new Map();
            }
        }
    }

    private saveCache() {
        const obj = Object.fromEntries(this.cache);
        fs.writeFileSync(CACHE_FILE, JSON.stringify(obj), 'utf-8');
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
            return undefined;
        }
        const key = `${stringType}:${id}`;
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        else {
            const esiName = await this.getNameFromESI(id, stringType);
            if (esiName) {
                this.setName(key, esiName);
                return esiName;
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
        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.name;
            }
        }
        catch {
            // ignore errors
        }
        return undefined;
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
        return undefined;
    }
}
