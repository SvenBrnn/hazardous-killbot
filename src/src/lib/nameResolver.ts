import * as fs from 'fs';
import * as path from 'path';
import { EsiClient } from './esiClient';
import { SubscriptionType } from '../zKillSubscriber';


// List of types to cache
const CACHED_TYPES = new Set<SubscriptionType>([
    SubscriptionType.REGION,
    SubscriptionType.CONSTELLATION,
    SubscriptionType.SYSTEM,
    SubscriptionType.corporation,
    SubscriptionType.ALLIANCE,
    SubscriptionType.CHARACTER,
    SubscriptionType.GROUP,
    SubscriptionType.SHIP,
]);

function getCacheFile(type: SubscriptionType): string {
    const cacheDir = path.resolve(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    return path.join(cacheDir, `namesCache.${type}.json`);
}

export class NameResolver {
    protected static instance: NameResolver;
    private caches: Map<SubscriptionType, Map<string, string>> = new Map();
    private saveScheduled: Map<SubscriptionType, boolean> = new Map();

    private constructor() {
        Object.values(SubscriptionType).forEach(type => {
            if (CACHED_TYPES.has(type as SubscriptionType)) {
                this.loadCache(type as SubscriptionType);
            }
        });
    }

    public static getInstance(): NameResolver {
        if (!this.instance) {
            this.instance = new NameResolver();
        }
        return this.instance;
    }

    private loadCache(type: SubscriptionType) {
        if (!CACHED_TYPES.has(type)) return;
        const cacheFile = getCacheFile(type);
        let cache = new Map<string, string>();
        if (fs.existsSync(cacheFile)) {
            try {
                const data = fs.readFileSync(cacheFile, 'utf-8');
                const obj = JSON.parse(data);
                cache = new Map(Object.entries(obj));
            }
            catch {
                cache = new Map();
            }
        }
        this.caches.set(type, cache);
    }

    private saveCache(type: SubscriptionType) {
        if (!CACHED_TYPES.has(type)) return;
        const cache = this.caches.get(type);
        if (!cache) return;
        const obj = Object.fromEntries(cache);
        fs.writeFileSync(getCacheFile(type), JSON.stringify(obj), 'utf-8');
    }

    private scheduleSaveCache(type: SubscriptionType) {
        if (!CACHED_TYPES.has(type)) return;
        if (!this.saveScheduled.get(type)) {
            this.saveScheduled.set(type, true);
            setTimeout(() => {
                this.saveCache(type);
                this.saveScheduled.set(type, false);
            }, 5000);
        }
    }

    public async getName(id: number, type: SubscriptionType): Promise<string | undefined> {
        const stringType = getSubscriptionTypeString(type);
        if (!stringType) {
            return undefined;
        }
        const key = `${stringType}:${id}`;
        let cache: Map<string, string> | undefined;
        if (CACHED_TYPES.has(type)) {
            cache = this.caches.get(type);
            if (!cache) {
                this.loadCache(type);
                cache = this.caches.get(type);
            }
            if (cache && cache.has(key)) {
                return cache.get(key);
            }
        }
        try {
            const esiClient = EsiClient.getInstance();
            const esiName = await esiClient.getNameFromESI(id, stringType);
            if (esiName && CACHED_TYPES.has(type)) {
                this.setName(type, key, esiName);
            }
            return esiName;
        }
        catch {
            // ignore errors
        }
        return undefined;
    }

    public setName(type: SubscriptionType, key: string, name: string) {
        if (!CACHED_TYPES.has(type)) return;
        let cache = this.caches.get(type);
        if (!cache) {
            cache = new Map();
            this.caches.set(type, cache);
        }
        cache.set(key, name);
        this.scheduleSaveCache(type);
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
