import { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { AbstractCommand } from './abstractCommand';
import { LimitType, ZKillSubscriber, Subscription } from '../zKillSubscriber';

export class ListSubscriptionsCommand extends AbstractCommand {
    protected override name = 'zkill-list-subscriptions';

    override executeCommand(interaction: ChatInputCommandInteraction): void {
        const sub = ZKillSubscriber.getInstance();
        if (!interaction.inGuild()) {
            interaction.reply('Listing subscriptions is not possible in PM!');
            return;
        }

        let reply = 'Here are all the subscriptions in this channel:\n';

        const subscriptionsInChannel = sub.getChannelSubscriptions(interaction.guildId, interaction.channelId);
        if (subscriptionsInChannel) {
            subscriptionsInChannel.subscriptions.forEach((subscription) => {
                reply += this.subscriptionToString(subscription) + '\n';
            });
        }
        interaction.reply({ content: reply, ephemeral: true });
    }

    private subscriptionToString(subscription: Subscription): string {
        const subType = subscription.subType as string;
        const limitType = subscription.limitType as string;
        const killType = subscription.killType as string | undefined;
        const minValue = subscription.minValue;
        const limitIds = subscription.limitIds;
        const id = subscription.id;

        let reply = 'Type: ' + subType + ' | ';
        if (id) {
            reply += 'ID: ' + id + ' | ';
        }
        if (limitType !== LimitType.NONE) {
            reply += 'Limit Type: ' + limitType + ' | ';
        }
        if (limitIds) {
            reply += 'Limit IDs: ' + limitIds + ' | ';
        }
        if (killType) {
            reply += 'Kill Type: ' + killType + ' | ';
        }
        if (minValue > 0) {
            reply += 'Min Value: ' + minValue + ' | ';
        }
        return reply;

    }

    getCommand(): SlashCommandBuilder {
        const slashCommand = new SlashCommandBuilder().setName(this.name)
            .setDescription('List all active subscriptions in this channel');

        return slashCommand;

    }
}