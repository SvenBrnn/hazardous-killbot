import mongoose, { Document, Schema } from 'mongoose';

export interface IPollingSequence extends Document {
    sequence: number;
    savedAt: Date;
}

const PollingSequenceSchema: Schema = new Schema({
    sequence: { type: Number, required: true },
    savedAt: { type: Date, required: true, default: () => new Date() },
});

export default mongoose.model<IPollingSequence>('PollingSequence', PollingSequenceSchema);

