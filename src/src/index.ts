// Require the necessary discord.js classes
import { Client, IntentsBitField } from 'discord.js';
import mongoose from 'mongoose';
import { registerCommands } from './commands/deployCommands';
import { ZKillSubscriber } from './zKillSubscriber';

process.setMaxListeners(100);

// Create a new client instance
const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });

// Initialize Mongoose
mongoose.connect('mongodb://mongodb:27017/eve-discord-bot', {}).then(() => {

    registerCommands(client);
    const sub = ZKillSubscriber.getInstance(client);

    // When the client is ready, run this code (only once)
    client.once('ready', () => {
        console.log(`Ready on ${client.guilds.cache.size} servers!`);
    });

    client.on('guildDelete', guild => {
        if (guild.name === undefined) return;
        sub.unsubscribeGuild(guild.id);

        console.log(`Got kicked from a Server!\n- Name: ${guild.name}\n- Member Count: ${guild.memberCount}\nI'm now in ${client.guilds.cache.size} Servers!`);
    });

    //  joined a server
    client.on('guildCreate', guild => {
        if (guild.name === undefined) return;

        console.log(`Joined new Server!\n- Name: ${guild.name}\n- Member Count: ${guild.memberCount}\nI'm now in ${client.guilds.cache.size} Servers!`);
        //  Your other stuff like adding to guildArray
    });

    // Login to Discord with your client's token
    client.login(process.env.DISCORD_BOT_TOKEN);
}).catch((err) => {
    console.error(err);
    process.exit(1);
});

