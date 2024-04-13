import mongoose, { Document, Schema } from 'mongoose';

export interface ISolarSystem extends Document{
    eveId: number
    name: string
    regionId: number
    regionName: string
    constellationId: number
    constellationName: string
}

const SolarSystemSchema: Schema = new Schema({
    eveId: { type: Number, required: true },
    name: { type: String, required: true },
    regionId: { type: Number, required: true },
    regionName: { type: String, required: true },
    constellationId: { type: Number, required: true },
    constellationName: { type: String, required: true },
});

export default mongoose.model<ISolarSystem>('Systems', SolarSystemSchema);
