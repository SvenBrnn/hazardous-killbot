import mongoose, { Document, Schema } from 'mongoose';

export interface IAlliances extends Document {
    eveId: number;
    name: string;
    // Add more fields as needed
}

const AlliancesSchema: Schema = new Schema({
    eveId: { type: Number, required: true },
    name: { type: String, required: true },
});

export default mongoose.model<IAlliances>('Alliances', AlliancesSchema);