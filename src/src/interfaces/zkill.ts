import { ISolarSystem } from '../models/system';
import { ICharacters } from '../models/characters';
import { ICorps } from '../models/corps';
import { IAlliances } from '../models/alliances';
import { IShips } from '../models/ships';
import { IFaction } from '../models/faction';

interface IZkill {
    attackers: IZkillAttacker[];
    killmail_id: number;
    killmail_time: string;
    solar_system_id: number;
    victim: IZkillVictim;
    zkb: IZkillZkb;
    extendedVictim?: IZkillExtended
    extendedFinalBlow?: IZkillExtended
}

export interface IZkillExtended {
    systemData: ISolarSystem;
    character?: ICharacters
    corporation?: ICorps
    alliance?: IAlliances
    faction?: IFaction
    ship?: IShips
}

interface IZkillAttacker {
    alliance_id: number;
    character_id: number;
    corporation_id: number;
    damage_done: number;
    faction_id: number;
    final_blow: boolean;
    security_status: number;
    ship_type_id: number;
    weapon_type_id: number;
}

interface IZkillVictim {
    alliance_id: number;
    character_id: number;
    corporation_id: number;
    damage_taken: number;
    faction_id: number;
    items: any[];
    position: IZkillPosition;
    ship_type_id: number;
}

interface IZkillPosition {
    x: number;
    y: number;
    z: number;
}

interface IZkillZkb {
    locationID: number;
    hash: string;
    fittedValue: number;
    droppedValue: number;
    destroyedValue: number;
    totalValue: number;
    points: number;
    npc: boolean;
    solo: boolean;
    awox: boolean;
    esi: string;
    url: string;
}

export { IZkill, IZkillAttacker, IZkillVictim, IZkillPosition, IZkillZkb };