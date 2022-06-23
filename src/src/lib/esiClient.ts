import {Axios, AxiosResponse} from 'axios';
import {SolarSystem} from '../zKillSubscriber';

const ESI_URL = 'https://esi.evetech.net/latest/';
const GET_SOLAR_SYSTEM_URL = 'universe/systems/%1/';
const GET_CONSTELLATION_URL = 'universe/constellations/%1/';
const GET_REGION_URL = 'universe/regions/%1/';

export class EsiClient {
    private axios: Axios;

    constructor() {
        this.axios = new Axios({baseURL: ESI_URL, responseType: 'json', transformResponse: data => JSON.parse(data)});
    }

    async fetch(path: string) : Promise<AxiosResponse<any, any>> {
        return await this.axios.get(path);
    }

    async getSystemInfo(systemId: number): Promise<SolarSystem> {
        const systemData = await this.fetch(GET_SOLAR_SYSTEM_URL.replace('%1', systemId.toString()));
        if(systemData.data.error) {
            throw new Error('SYSTEM_FETCH_ERROR');
        }
        const constData = await this.fetch(GET_CONSTELLATION_URL.replace('%1', systemData.data.constellation_id));
        if(systemData.data.error) {
            throw new Error('CONST_FETCH_ERROR');
        }
        const regionData = await this.fetch(GET_REGION_URL.replace('%1', constData.data.region_id));
        if(systemData.data.error) {
            throw new Error('REGION_FETCH_ERROR');
        }

        return {
            id: systemId,
            regionId: regionData.data.region_id,
            regionName: regionData.data.name,
            constellationId: constData.data.constellation_id,
            constellationName: constData.data.name
        };
    }
}