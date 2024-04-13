import mongoose, { Document, Schema } from 'mongoose';

export interface IFaction extends Document {
    eveId: number;
    name: string;
    // Add more fields as needed
}

const FactionSchema: Schema = new Schema({
    eveId: { type: Number, required: true },
    name: { type: String, required: true },
});

export default mongoose.model<IFaction>('Faction', FactionSchema);