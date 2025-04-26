import * as fs from 'fs';
import * as path from 'path';
import { EsiClient } from './esiClient';
import { LimitType, SubscriptionType } from '../zKillSubscriber';

// Add a simple logger
function log(...args: any[]) {
    // You can enhance this to use a proper logger if needed
    console.log('[NameResolver]', ...args);
}

// List of types to cache
const CACHED_TYPES = new Set<string>([
    SubscriptionType.REGION,
    SubscriptionType.CONSTELLATION,
    SubscriptionType.SYSTEM,
    SubscriptionType.corporation,
    SubscriptionType.ALLIANCE,
    SubscriptionType.CHARACTER,
    SubscriptionType.GROUP,
    SubscriptionType.SHIP,
]);

function getCacheFile(type: string): string {
    const cacheDir = path.resolve(__dirname, 'cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        log(`Created cache directory at ${cacheDir}`);
    }
    return path.join(cacheDir, `namesCache.${type}.json`);
}

export class NameResolver {
    protected static instance: NameResolver;
    private caches: Map<string, Map<string, string>> = new Map();
    private saveScheduled: Map<string, boolean> = new Map();

    private constructor() {
        Object.values(SubscriptionType).forEach(type => {
            if (CACHED_TYPES.has(type as SubscriptionType)) {
                this.loadCache(type as SubscriptionType);
            }
        });
        log('Initialized NameResolver with cached types:', Array.from(CACHED_TYPES).join(', '));
    }

    public static getInstance(): NameResolver {
        if (!this.instance) {
            this.instance = new NameResolver();
            log('Created NameResolver singleton instance');
        }
        return this.instance;
    }

    private loadCache(type: string) {
        if (!CACHED_TYPES.has(type)) return;
        const cacheFile = getCacheFile(type);
        let cache = new Map<string, string>();
        if (fs.existsSync(cacheFile)) {
            try {
                const data = fs.readFileSync(cacheFile, 'utf-8');
                const obj = JSON.parse(data);
                cache = new Map(Object.entries(obj));
                log(`Loaded cache for type ${type} from ${cacheFile} (${cache.size} entries)`);
            }
            catch (err) {
                log(`Failed to load cache for type ${type} from ${cacheFile}:`, err);
                cache = new Map();
            }
        }
        else {
            log(`No cache file found for type ${type}, starting with empty cache.`);
        }
        this.caches.set(type, cache);
    }

    private saveCache(type: string) {
        if (!CACHED_TYPES.has(type)) return;
        const cache = this.caches.get(type);
        if (!cache) return;
        const obj = Object.fromEntries(cache);
        fs.writeFileSync(getCacheFile(type), JSON.stringify(obj), 'utf-8');
        log(`Saved cache for type ${type} (${cache.size} entries)`);
    }

    private scheduleSaveCache(type: string) {
        if (!CACHED_TYPES.has(type)) return;
        if (!this.saveScheduled.get(type)) {
            this.saveScheduled.set(type, true);
            setTimeout(() => {
                this.saveCache(type);
                this.saveScheduled.set(type, false);
            }, 5000);
            log(`Scheduled cache save for type ${type} in 5 seconds`);
        }
    }

    public async getNameBySubscriptionType(id: number, type: SubscriptionType): Promise<string | undefined> {
        const stringType = getSubscriptionTypeString(type);
        if (!stringType) {
            log(`Unknown subscription type: ${type}`);
            return undefined;
        }
        return await this.getName(id, stringType);
    }

    public async getNamesByLimitType(ids: string, type: LimitType): Promise<string | undefined> {
        const idArray = ids.split(',').map(id => id.trim());
        const stringType = getLimitTypeString(type);
        if (!stringType) {
            log(`Unknown limit type: ${type}`);
            return undefined;
        }
        const names = await Promise.all(
            idArray.map(async (id) => {
                const numId = Number(id);
                const name = await this.getName(numId, stringType);
                return name ? name : id;
            }),
        );
        return names.join(', ');
    }

    private async getName(id: number, stringType: string): Promise<string | undefined> {
        const key = `${stringType}:${id}`;
        let cache: Map<string, string> | undefined;
        if (CACHED_TYPES.has(stringType)) {
            cache = this.caches.get(stringType);
            if (!cache) {
                this.loadCache(stringType);
                cache = this.caches.get(stringType);
            }
            if (cache && cache.has(key)) {
                log(`Cache hit for ${key}`);
                return cache.get(key);
            }
            else {
                log(`Cache miss for ${key}`);
            }
        }
        try {
            const esiClient = EsiClient.getInstance();
            const esiName = await esiClient.getNameFromESI(id, stringType);
            if (esiName && CACHED_TYPES.has(stringType)) {
                this.setName(stringType, key, esiName);
                log(`Fetched and cached name for ${key}: ${esiName}`);
            }
            else {
                log(`Fetched name for ${key}: ${esiName}`);
            }
            return esiName;
        }
        catch (err) {
            log(`Error fetching name for ${key}:`, err);
        }
        return undefined;
    }

    public setName(type: string, key: string, name: string) {
        if (!CACHED_TYPES.has(type)) return;
        let cache = this.caches.get(type);
        if (!cache) {
            cache = new Map();
            this.caches.set(type, cache);
        }
        cache.set(key, name);
        this.scheduleSaveCache(type);
        log(`Set name in cache for ${key}: ${name}`);
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

function getLimitTypeString(type: LimitType): string | undefined {
    switch (type) {
    case LimitType.REGION:
        return 'universe/regions';
    case LimitType.CONSTELLATION:
        return 'universe/constellations';
    case LimitType.SYSTEM:
        return 'universe/systems';
    default:
        return undefined;
    }
}
