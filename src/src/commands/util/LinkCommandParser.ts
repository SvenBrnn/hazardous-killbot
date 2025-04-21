import { ChatInputCommandInteraction } from 'discord.js';
import { KillType } from '../../zKillSubscriber';

export class LinkCommandParser {
    protected static instance: LinkCommandParser;

    static getInstance(): LinkCommandParser {
        if (!this.instance) {
            this.instance = new LinkCommandParser();
        }

        return this.instance;
    }

    parse(interaction: ChatInputCommandInteraction): LinkParseResult {
        const validPaths = ['corporation', 'character', 'alliance', 'system', 'constellation', 'region', 'ship', 'group'];
        const regex = new RegExp(`^https://zkillboard\\.com/(${validPaths.join('|')})/(\\d+)/(losses|kills)?/?$`);

        const link = interaction.options.getString('link');
        if (!link || !regex.test(link)) {
            throw new Error('Invalid link format. Please provide a valid zKillboard link.');
        }

        const match = regex.exec(link);
        if (!match) {
            throw new Error('Failed to parse the link.');
        }

        const [, type, id, killType] = match;

        const parsedId = parseInt(id, 10);
        if (isNaN(parsedId)) {
            throw new Error('Invalid ID in the link. Please provide a valid zKillboard link.');
        }
        return new LinkParseResult(type, parsedId, killType as KillType | undefined);
    }
}

export class LinkParseResult {
    type: string;
    id: number;
    killType: KillType | undefined;

    constructor(type: string, id: number, killType: KillType | undefined) {
        this.type = type;
        this.id = id;
        this.killType = killType;
    }
}
