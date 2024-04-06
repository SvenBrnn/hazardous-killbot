import MemoryCache from 'memory-cache';
import { Colors, DiscordAPIError, MessageCreateOptions, TextChannel } from 'discord.js';
import ogs from 'open-graph-scraper';
import { SubscriptionType, ZKillSubscriber } from '../zKillSubscriber';

export async function sendKillMailToDiscord(zkillSub : ZKillSubscriber, guildId: string, channelId: string, subType: SubscriptionType, data: any, subId?: number, messageColor: number = Colors.Grey) {
    const cache = MemoryCache.get(`${channelId}_${data.killmail_id}`);
    // Mail was already send, prevent from sending twice
    if (cache) {
        return;
    }
    const c = <TextChannel> await zkillSub.getDoClient().channels.cache.get(channelId);
    if (c) {
        let embedding = null;
        try {
            embedding = await ogs({ url: data.zkb.url });
        }
        catch (e) {
            // Do nothing
        }
        try {
            const content: MessageCreateOptions = {};
            const image = embedding?.result.ogImage ? embedding?.result.ogImage[0].url : '';
            if (embedding?.error === false) {
                content.embeds = [{
                    title: embedding?.result.ogTitle,
                    description: embedding?.result.ogDescription,
                    thumbnail: image ? {
                        url: image,
                    } : undefined,
                    url: data.zkb.url,
                    color: messageColor,
                }];
            }
            else {
                content.content = data.zkb.url;
            }
            await c.send(
                content,
            );
            MemoryCache.put(`${channelId}_${data.killmail_id}`, 'send', 60000); // Prevent from sending again, cache it for 1 min
        }
        catch (e) {
            if (e instanceof DiscordAPIError && e.status === 403) {
                try {
                    const owner = await c.guild.fetchOwner();
                    await owner.send(`The bot unsubscribed from channel ${c.name} on ${c.guild.name} because it was not able to write in it! Fix the permissions and subscribe again!`);
                    console.log(`Sent message to owner of ${c.guild.name} to notify him/her about the permission problem.`);
                }
                catch (e2) {
                    console.log(e2);
                }
                const subscriptionsInChannel = zkillSub.getSubscriptions(guildId)?.channels.get(channelId);
                if (subscriptionsInChannel) {
                    // Unsubscribe all events from channel
                    subscriptionsInChannel.subscriptions.forEach((subscription) => {
                        zkillSub.unsubscribe(subscription.subType, guildId, channelId, subscription.id);
                    });
                }
            }
            else {
                console.log(e);
            }
        }
    }
    else {
        await zkillSub.unsubscribe(subType, guildId, channelId, subId);
    }
}