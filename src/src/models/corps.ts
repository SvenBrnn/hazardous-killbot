import mongoose, { Document, Schema } from 'mongoose';

export interface ICorps extends Document {
    eveId: number;
    name: string;
    // Add more fields as needed
}

const CorpsSchema: Schema = new Schema({
    eveId: { type: Number, required: true },
    name: { type: String, required: true },
});

export default mongoose.model<ICorps>('Corps', CorpsSchema);