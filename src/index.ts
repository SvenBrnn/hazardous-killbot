// Require the necessary discord.js classes
import { Client, Intents } from 'discord.js';
import {registerCommands} from './commands/deployCommands';
import {ZKillSubscriber} from './zKillSubscriber';

process.setMaxListeners(100);

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

registerCommands(client);
const sub = ZKillSubscriber.getInstance(client);

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log(`Ready on ${client.guilds.cache.size} servers!`);
});

client.on('guildDelete', guild => {
    if(guild.name === undefined) return;
    sub.unsubscribeGuild(guild.id);

    console.log(`Got kicked from a Server!\n- Name: ${guild.name}\n- Member Count: ${guild.memberCount}\nI'm now in ${client.guilds.cache.size} Servers!`);
});

//joined a server
client.on('guildCreate', guild => {
    if(guild.name === undefined) return;

    console.log(`Joined new Server!\n- Name: ${guild.name}\n- Member Count: ${guild.memberCount}\nI'm now in ${client.guilds.cache.size} Servers!`);
    //Your other stuff like adding to guildArray
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_BOT_TOKEN);
