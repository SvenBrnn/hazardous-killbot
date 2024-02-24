import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { AbstractCommand } from './abstractCommand';
import { SubscriptionType, ZKillSubscriber } from '../zKillSubscriber';

export class UnsubscribeCommand extends AbstractCommand {
    protected override name = 'zkill-unsubscribe';
    override executeCommand(interaction: ChatInputCommandInteraction): void {
        const sub = ZKillSubscriber.getInstance();

        if (!interaction.inGuild()) {
            interaction.reply('Subscription is not possible in PM!');
            return;
        }
        const subCommand = interaction.options.getSubcommand(true) as SubscriptionType;
        const id = interaction.options.getNumber('id', false);
        sub.unsubscribe(subCommand, interaction.guildId, interaction.channelId, id ? id : undefined);
        interaction.reply({
            content: 'We unscubscribed to zkillboard channel: ' + interaction.options.getSubcommand() + ' ' + interaction.options.getNumber('id'),
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

        return slashCommand;

    }

}