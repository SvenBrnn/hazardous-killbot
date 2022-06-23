import {SlashCommandBuilder, SlashCommandSubcommandBuilder} from '@discordjs/builders';
import {CommandInteraction} from 'discord.js';
import {AbstractCommand} from './abstractCommand';
import {SubscriptionType, ZKillSubscriber} from '../zKillSubscriber';

export class SubscribeCommand extends AbstractCommand {
    protected name = 'zkill-subscribe';

    executeCommand(interaction: CommandInteraction): void {
        const sub = ZKillSubscriber.getInstance();
        if(!interaction.inGuild()) {
            interaction.reply('Subscription is not possible in PM!');
            return;
        }
        const subCommand = interaction.options.getSubcommand(true) as SubscriptionType;
        const id = interaction.options.getNumber('id', false);
        const minValue = interaction.options.getNumber('min-value');
        sub.subscribe(subCommand, interaction.guildId, interaction.channelId, id ? id : undefined, minValue ? minValue : 0);

        let reply = 'We subscribed to zkillboard channel: ' + interaction.options.getSubcommand();
        if(id) {
            reply += ' ID: ' + id;
        }
        if(minValue) {
            reply += ' Min Value: ' + minValue.toLocaleString('en');
        }
        interaction.reply(reply);
    }

    getCommand(): SlashCommandBuilder {
        const slashCommand = new SlashCommandBuilder().setName(this.name)
            .setDescription('Subscribe to zkill');


        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('corporation')
            .setDescription('Subscribe corporation to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the corporation')
                    .setRequired(true)
            )
            .addNumberOption(option =>
                option.setName('min-value')
                    .setDescription('Minimum isk to show the entry')
                    .setRequired(false)
            ));

        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('alliance')
            .setDescription('Subscribe alliance to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the alliance')
                    .setRequired(true)
            )
            .addNumberOption(option =>
                option.setName('min-value')
                    .setDescription('Minimum isk to show the entry')
                    .setRequired(false)
            ));

        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('character')
            .setDescription('Subscribe character to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the character')
                    .setRequired(true)

            )
            .addNumberOption(option =>
                option.setName('min-value')
                    .setDescription('Minimum isk to show the entry')
                    .setRequired(false)
            ));

        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('region')
            .setDescription('Subscribe character to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the region')
                    .setRequired(true)

            )
            .addNumberOption(option =>
                option.setName('min-value')
                    .setDescription('Minimum isk to show the entry')
                    .setRequired(false)
            ));

        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('constellation')
            .setDescription('Subscribe character to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the constellation')
                    .setRequired(true)

            )
            .addNumberOption(option =>
                option.setName('min-value')
                    .setDescription('Minimum isk to show the entry')
                    .setRequired(false)
            ));

        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('system')
            .setDescription('Subscribe character to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the system')
                    .setRequired(true)

            )
            .addNumberOption(option =>
                option.setName('min-value')
                    .setDescription('Minimum isk to show the entry')
                    .setRequired(false)
            ));

        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('public')
            .addNumberOption(option =>
                option.setName('min-value')
                    .setDescription('Minimum isk to show the entry')
                    .setRequired(false)
            )
            .setDescription('Subscribe public feed to channel'));

        return slashCommand;

    }

}