import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { AbstractCommand } from './abstractCommand';
import { LinkCommandParser } from './util/linkCommandParser';
import { SubscriptionType, ZKillSubscriber } from '../zKillSubscriber';
import { NameResolver } from '../lib/nameResolver';

export class UnsubscribeCommand extends AbstractCommand {
    protected override name = 'zkill-unsubscribe';
    override async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = ZKillSubscriber.getInstance();

        if (!interaction.inGuild()) {
            interaction.reply('Subscription is not possible in PM!');
            return;
        }
        const subCommand = interaction.options.getSubcommand(true) as SubscriptionType;
        if (subCommand === SubscriptionType.LINK) {
            try {
                const parser = LinkCommandParser.getInstance();
                const parseResult = parser.parse(interaction);
                const type = parseResult.type as SubscriptionType;
                const id = parseResult.id;

                let reply = `We unsubscribed from zkillboard channel: link (\`${type}\`)`;
                if (id) {
                    const nameResolver = NameResolver.getInstance();
                    const name = await nameResolver.getNameBySubscriptionType(id, type);
                    if (name) {
                        reply += `\n**Name:** ${name}`;
                    }
                    else {
                        reply += `\n**ID:** ${id}`;
                    }
                }

                sub.unsubscribe(type, interaction.guildId, interaction.channelId, id);
                interaction.reply({ content: reply, ephemeral: true });
            }
            catch {
                interaction.reply({ content: 'Invalid link format. Please provide a valid zKillboard link.', ephemeral: true });
                return;
            }
            return;
        }

        const id = interaction.options.getNumber('id', false);

        let reply = 'We unsubscribed from zkillboard channel: ' + interaction.options.getSubcommand();
        if (id) {
            const nameResolver = NameResolver.getInstance();
            const name = await nameResolver.getNameBySubscriptionType(id, subCommand);
            if (name) {
                reply += `\n**Name:** ${name}`;
            }
            else {
                reply += `\n**ID:** ${id}`;
            }
        }
        else {
            reply += '';
        }
        sub.unsubscribe(subCommand, interaction.guildId, interaction.channelId, id ? id : undefined);
        interaction.reply({
            content:  reply,
            ephemeral: true,
        });
    }

    override getCommand(): SlashCommandBuilder {
        const slashCommand = new SlashCommandBuilder().setName(this.name)
            .setDescription('Unsubscribe from zkill');


        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('corporation')
            .setDescription('Unsubscribe corporation to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the corporation')
                    .setRequired(true),
            ));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('alliance')
            .setDescription('Unsubscribe alliance from channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the alliance')
                    .setRequired(true),
            ));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('character')
            .setDescription('Unsubscribe character from channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the character')
                    .setRequired(true),
            ));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('group')
            .setDescription('Unsubscribe group from channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the character')
                    .setRequired(true),
            ));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('ship')
            .setDescription('Unsubscribe ship from channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the ship')
                    .setRequired(true),
            ));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('region')
            .setDescription('Unsubscribe character from channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the character')
                    .setRequired(true),
            ));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('constellation')
            .setDescription('Unsubscribe character from channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the character')
                    .setRequired(true),
            ));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('system')
            .setDescription('Unsubscribe character from channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the character')
                    .setRequired(true),
            ));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('public')
            .setDescription('Unsubscribe public feed from channel'));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('all')
            .setDescription('Unsubscribe everything from channel'));

        slashCommand.addSubcommand(new SlashCommandSubcommandBuilder().setName('link')
            .setDescription('Unsubscribe link from channel')
            .addStringOption(option =>
                option.setName('link')
                    .setDescription('Link to zkillboard')
                    .setRequired(true),
            ));

        return slashCommand;

    }

}