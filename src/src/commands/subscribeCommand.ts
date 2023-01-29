import {SlashCommandBuilder, SlashCommandSubcommandBuilder} from '@discordjs/builders';
import {CommandInteraction} from 'discord.js';
import {AbstractCommand} from './abstractCommand';
import {LimitType, SubscriptionType, ZKillSubscriber} from '../zKillSubscriber';

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
        const limitRegion = interaction.options.getString('limit-region-ids');
        const limitConstellation = interaction.options.getString('limit-constellation-ids');
        const limitSystem = interaction.options.getString('limit-system-ids');

        let reply = 'We subscribed to zkillboard channel: ' + interaction.options.getSubcommand();
        let limitType: LimitType = LimitType.NONE, limitIds;
        if(limitConstellation || limitRegion || limitSystem) {
            if(limitConstellation && limitRegion || limitConstellation && limitSystem || limitRegion && limitSystem) {
                interaction.reply({content: 'Only one type of limit is allowed!', ephemeral: true});
                return;
            }
            if(limitRegion) {
                limitType = LimitType.REGION;
                limitIds = limitRegion;
                reply = 'Region filter: + ' + limitRegion;
            }
            if(limitConstellation) {
                limitType = LimitType.CONSTELLATION;
                limitIds = limitConstellation;
                reply = 'Constellation filter: + ' + limitRegion;
            }
            if(limitSystem) {
                limitType = LimitType.SYSTEM;
                limitIds = limitSystem;
                reply = 'System filter: + ' + limitRegion;

            }
        }
        sub.subscribe(subCommand, interaction.guildId, interaction.channelId, id ? id : undefined, minValue ? minValue : 0, limitType, limitIds);

        if(id) {
            reply += ' ID: ' + id;
        }
        if(minValue) {
            reply += ' Min Value: ' + minValue.toLocaleString('en');
        }
        interaction.reply({content: reply, ephemeral: true});
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
            .addStringOption(option =>
                option.setName('limit-region-ids')
                    .setDescription('Limit to region id, comma seperated ids')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('limit-constellation-ids')
                    .setDescription('Limit to constellation id, comma seperated ids')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('limit-system-ids')
                    .setDescription('Limit to system id, comma seperated ids')
                    .setRequired(false)
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
            .addStringOption(option =>
                option.setName('limit-region-ids')
                    .setDescription('Limit to region id, comma seperated ids')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('limit-constellation-ids')
                    .setDescription('Limit to constellation id, comma seperated ids')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('limit-system-ids')
                    .setDescription('Limit to system id, comma seperated ids')
                    .setRequired(false)
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

        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('group')
            .setDescription('Subscribe group to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the group')
                    .setRequired(true)

            )
            .addNumberOption(option =>
                option.setName('min-value')
                    .setDescription('Minimum isk to show the entry')
                    .setRequired(false)
            ));

        slashCommand.addSubcommand( new SlashCommandSubcommandBuilder().setName('ship')
            .setDescription('Subscribe ship to channel')
            .addNumberOption(option =>
                option.setName('id')
                    .setDescription('ID for the group')
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
            .addStringOption(option =>
                option.setName('limit-region-ids')
                    .setDescription('Limit to region id, comma seperated ids')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('limit-constellation-ids')
                    .setDescription('Limit to constellation id, comma seperated ids')
                    .setRequired(false)
            )
            .addStringOption(option =>
                option.setName('limit-system-ids')
                    .setDescription('Limit to system id, comma seperated ids')
                    .setRequired(false)
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