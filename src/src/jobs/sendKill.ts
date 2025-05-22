import MemoryCache from 'memory-cache';
import { Colors, DiscordAPIError, MessageCreateOptions, TextChannel } from 'discord.js';
import { SubscriptionType, ZKillSubscriber } from '../zKillSubscriber';
import { IZkill } from '../interfaces/zkill';

const locks = new Set<string>(); // Global lock set

export async function sendKillMailToDiscord(zkillSub : ZKillSubscriber, guildId: string, channelId: string, subType: SubscriptionType, data: IZkill, subId?: number, messageColor: number = Colors.Grey) {
    const cacheKey = `${channelId}_${data.killmail_id}`;
    const cache = MemoryCache.get(cacheKey);

    // Mail was already sent, prevent from sending twice
    if (cache) {
        return;
    }

    // Check if a lock exists for this key
    if (locks.has(cacheKey)) {
        return; // Another process is already handling this killmail for this channel
    }

    // Acquire the lock
    locks.add(cacheKey);

    try {
        const c = <TextChannel> await zkillSub.getDoClient().channels.cache.get(channelId);
        if (c) {
            try {
                const content: MessageCreateOptions = {};
                // IMAGE IS https://images.evetech.net/types/2233/render?size=128
                // Title is "Customs Office | Red Fang Holding INC | Killmail" for Structure
                // Title is "Tempest Fleet Issue | Incana Pirahnas | Killmail" for Ship (Incana Pirahnas is the pilot)
                // Text is "(Red Fang Holding INC) lost their Customs Office in Kor-Azor Prime (Kor-Azor). Final Blow by Nathan Steeles (Aegis Contractors) flying in a Kronos. Total Value: 166,915,678.88 ISK" for Structure
                // Text is "Incana Pirahnas (Nano Gang) lost their Tempest Fleet Issue in Basan (Domain). Final Blow by Elisiist Aldent (Vertex Armada) flying in a Tempest Fleet Issue. Total Value: 856,315,831.55 ISK"" for Ship
                // Structures have no pilot, ships have a pilot
                // If the pilot lost to a faction the text is "Potential Impact (Peoples Liberation Army) lost their Tristan in Nalvula (Pochven) Total Value: 1,694,939.15 ISK"

                const image = `https://images.evetech.net/types/${data.victim.ship_type_id}/render?size=128`;
                let title = '';
                let description = '';
                const formatedIskValue = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ISK' }).format(data.zkb.totalValue);

                if (!data.victim.character_id) {
                    title = `${data.extendedVictim?.ship?.name} | ${data.extendedVictim?.corporation?.name} | Killmail`;
                    description = `${data.extendedVictim?.corporation?.name} lost their ${data.extendedVictim?.ship?.name} in ${data.extendedVictim?.systemData.name} (${data.extendedVictim?.systemData.regionName}). Final Blow by ${data.extendedFinalBlow?.character?.name} (${data.extendedFinalBlow?.corporation?.name}) flying in a ${data.extendedFinalBlow?.ship?.name}. Total Value: ${formatedIskValue} ISK`;
                }
                else if (data.extendedFinalBlow?.corporation) {
                    title = `${data.extendedVictim?.character?.name} (${data.extendedVictim?.corporation?.name}) | ${data.extendedVictim?.ship?.name} | Killmail`;
                    description = `${data.extendedVictim?.character?.name} (${data.extendedVictim?.corporation?.name}) lost their ${data.extendedVictim?.ship?.name} in ${data.extendedVictim?.systemData.name} (${data.extendedVictim?.systemData.regionName}). Final Blow by ${data.extendedFinalBlow?.character?.name} (${data.extendedFinalBlow?.corporation?.name}) flying in a ${data.extendedFinalBlow?.ship?.name}. Total Value: ${formatedIskValue} ISK`;
                }
                else {
                    title = `${data.extendedVictim?.character?.name} | ${data.extendedVictim?.corporation?.name} | Killmail`;
                    description = `${data.extendedVictim?.character?.name} (${data.extendedVictim?.corporation?.name}) lost their ${data.extendedVictim?.ship?.name} in ${data.extendedVictim?.systemData.name} (${data.extendedVictim?.systemData.regionName}). Total Value: ${formatedIskValue} ISK`;
                }

                content.embeds = [{
                    title: title,
                    description: description,
                    thumbnail: {
                        url: image,
                    },
                    url: data.zkb.url,
                    color: messageColor,
                }];

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
                    const subscriptionsInChannel = zkillSub.getChannelSubscriptions(guildId, channelId);
                    if (subscriptionsInChannel) {
                        // Unsubscribe all events from channel
                        subscriptionsInChannel.subscriptions.forEach((subscription) => {
                            zkillSub.unsubscribe(subscription.subType, guildId, channelId, subscription.id);
                        });
                    }
                }
                else {
                    console.log(e);
                    throw e;
                }
            }
        }
        else {
            await zkillSub.unsubscribe(subType, guildId, channelId, subId);
        }
    }
    finally {
        // Release the lock
        locks.delete(cacheKey);
    }
}