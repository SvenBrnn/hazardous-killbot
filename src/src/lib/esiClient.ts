import { Axios, AxiosResponse } from 'axios';
import SolarSystemSchema, { ISolarSystem } from '../models/system';
import ShipsSchema, { IShips } from '../models/ships';

const ESI_URL = 'https://esi.evetech.net/latest/';
const GET_SOLAR_SYSTEM_URL = 'universe/systems/%1/';
const GET_CONSTELLATION_URL = 'universe/constellations/%1/';
const GET_REGION_URL = 'universe/regions/%1/';
const GET_TYPE_DATA_URL = '/universe/types/%1/';
const GET_NAMES_POST_URL = '/universe/names/';

export class EsiClient {
    private axios: Axios;
    static instance: EsiClient;

    static getInstance(): EsiClient {
        if (!EsiClient.instance) {
            EsiClient.instance = new EsiClient();
        }
        return EsiClient.instance;
    }

    constructor() {
        this.axios = new Axios(
            {
                headers: {
                    'User-Agent': 'EVE-Discord-Bot',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                baseURL: ESI_URL,
                responseType: 'json',
                transformResponse: (data) => {
                    return JSON.parse(data);
                },
            });
    }

    async fetch(path: string): Promise<AxiosResponse<any, any>> {
        return await this.axios.get(path);
    }

    async post(path: string, data: any): Promise<AxiosResponse<any, any>> {
        return await this.axios.post(path, data);
    }

    async getSystemInfo(systemId: number): Promise<ISolarSystem> {
        const systemData = await this.fetch(GET_SOLAR_SYSTEM_URL.replace('%1', systemId.toString()));
        if (systemData.data.error) {
            throw new Error('SYSTEM_FETCH_ERROR');
        }
        const constData = await this.fetch(GET_CONSTELLATION_URL.replace('%1', systemData.data.constellation_id));
        if (systemData.data.error) {
            throw new Error('CONST_FETCH_ERROR');
        }
        const regionData = await this.fetch(GET_REGION_URL.replace('%1', constData.data.region_id));
        if (systemData.data.error) {
            throw new Error('REGION_FETCH_ERROR');
        }

        return await SolarSystemSchema.create({
            eveId: systemId,
            name: systemData.data.name,
            regionId: regionData.data.region_id,
            regionName: regionData.data.name,
            constellationId: constData.data.constellation_id,
            constellationName: constData.data.name,
        });
    }

    async getTypeGroupId(shipId: number): Promise<IShips> {
        const itemData = await this.fetch(GET_TYPE_DATA_URL.replace('%1', shipId.toString()));
        if (itemData.data.error) {
            throw new Error('ITEM_FETCH_ERROR');
        }
        return await ShipsSchema.create({
            eveId: shipId,
            name: itemData.data.name,
            group: itemData.data.group_id,
        });
    }

    async getCharacterData(missingIds: number[]): Promise<[
        {
            category: string;
            id: number;
            name: string;
        }]> {
        const missingNames = await this.post(GET_NAMES_POST_URL, JSON.stringify(missingIds));

        if (missingNames.data.error) {
            console.log('MISSING_NAMES_FETCH', missingIds);
            console.error('MISSING_NAMES_FETCH_ERROR', missingNames.data.error);
            throw new Error('MISSING_NAMES_FETCH_ERROR');
        }

        // log the missing names
        return missingNames.data;
    }

    public async getNameFromESI(id: number, type: string): Promise<string | undefined> {
        const url = `https://esi.evetech.net/latest/${type}/${id}/?datasource=tranquility`;
        const response = await this.fetch(url);
        if (response.data.error) {
            throw new Error('NAME_FETCH_ERROR');
        }
        return response.data.name;
    }

}