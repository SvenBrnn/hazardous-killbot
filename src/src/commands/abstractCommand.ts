import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';

export abstract class AbstractCommand {
    protected name = '';

    public getName() : string {
        return this.name;
    }

    public getCommand(): SlashCommandBuilder {
        throw new Error('Not implemented yet');
    }


    public executeCommand(interaction: CommandInteraction): void {
        throw new Error('Not implemented yet');
    }
}
