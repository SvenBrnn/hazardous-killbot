import mongoose, { Document, Schema } from 'mongoose';

export interface ICharacters extends Document {
    eveId: number;
    name: string;
    // Add more fields as needed
}

const CharactersSchema: Schema = new Schema({
    eveId: { type: Number, required: true },
    name: { type: String, required: true },
});

export default mongoose.model<ICharacters>('Characters', CharactersSchema);