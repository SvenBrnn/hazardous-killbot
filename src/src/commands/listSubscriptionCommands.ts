import { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { AbstractCommand } from './abstractCommand';
import { LimitType, ZKillSubscriber, Subscription } from '../zKillSubscriber';
import { NameResolver } from '../lib/nameResolver';

export class ListSubscriptionsCommand extends AbstractCommand {
    protected override name = 'zkill-list-subscriptions';

    override async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        const sub = ZKillSubscriber.getInstance();
        if (!interaction.inGuild()) {
            interaction.reply('Listing subscriptions is not possible in PM!');
            return;
        }

        let reply = '**Here are all the subscriptions in this channel:**\n\n';

        const subscriptionsInChannel = sub.getChannelSubscriptions(interaction.guildId, interaction.channelId);
        if (subscriptionsInChannel) {
            const lines = await Promise.all(
                Array.from(subscriptionsInChannel.subscriptions.values()).map(
                    async (subscription: Subscription) => {
                        return await this.subscriptionToString(subscription);
                    },
                ),
            );
            reply += lines.join('\n\n');
        }
        interaction.reply({ content: reply, ephemeral: true });
    }

    private async subscriptionToString(subscription: Subscription): Promise<string> {
        const subType = subscription.subType as string;
        const limitType = subscription.limitType as string;
        const killType = subscription.killType as string | undefined;
        const minValue = subscription.minValue;
        const limitIds = subscription.limitIds;
        const id = subscription.id;

        const lines: string[] = [];
        lines.push(`**Type:** \`${subType}\``);

        let unsubCommand = `/zkill-unsubscribe ${subType}`;
        if (id) {
            unsubCommand += ` id: ${id}`;
            const nameResolver = NameResolver.getInstance();
            const name = await nameResolver.getName(id, subscription.subType);
            if (name) {
                lines.push(`**Name:** ${name}`);
            }
            else {
                lines.push(`**ID:** ${id}`);
            }
        }

        if (limitType !== LimitType.NONE) {
            lines.push(`**Limit Type:** \`${limitType}\``);
        }
        if (limitIds) {
            lines.push(`**Limit IDs:** \`${limitIds}\``);
        }
        if (killType) {
            lines.push(`**Kill Type:** \`${killType}\``);
        }
        if (minValue > 0) {
            lines.push(`**Min Value:** \`${minValue.toLocaleString('en')}\``);
        }

        lines.push(`**Unsubscribe:**\n\`\`\`\n${unsubCommand}\n\`\`\``);

        return lines.join('\n');
    }

    getCommand(): SlashCommandBuilder {
        const slashCommand = new SlashCommandBuilder().setName(this.name)
            .setDescription('List all active subscriptions in this channel');

        return slashCommand;
    }
}