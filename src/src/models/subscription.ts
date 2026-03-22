import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscription extends Document {
    guildId: string;
    channelId: string;
    ident: string;
    subType: string;
    entityId?: number;
    minValue: number;
    limitType: string;
    limitIds?: string;
    killType?: string;
}

const SubscriptionSchema: Schema = new Schema({
    guildId:   { type: String, required: true },
    channelId: { type: String, required: true },
    ident:     { type: String, required: true },
    subType:   { type: String, required: true },
    entityId:  { type: Number },
    minValue:  { type: Number, required: true, default: 0 },
    limitType: { type: String, required: true, default: 'none' },
    limitIds:  { type: String },
    killType:  { type: String },
});

// Compound unique index: one ident per channel per guild
SubscriptionSchema.index({ guildId: 1, channelId: 1, ident: 1 }, { unique: true });

export default mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

