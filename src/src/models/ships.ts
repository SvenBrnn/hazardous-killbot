import mongoose, { Document, Schema } from 'mongoose';

export interface IShips extends Document {
    eveId: number;
    name: string;
    group: number;
    // Add more fields as needed
}

const ShipsSchema: Schema = new Schema({
    eveId: { type: Number, required: true },
    name: { type: String, required: true },
    group: { type: Number, required: true },
});

export default mongoose.model<IShips>('Ships', ShipsSchema);