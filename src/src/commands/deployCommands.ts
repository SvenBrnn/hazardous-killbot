import { Client } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { SubscribeCommand } from './subscribeCommand';
import { AbstractCommand } from './abstractCommand';
import { UnsubscribeCommand } from './unsubscribeCommand';

const commands: AbstractCommand[] = [
    new SubscribeCommand(),
    new UnsubscribeCommand(),
];

export function registerCommands(client: Client) {
    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN || '');

    /* rest.get(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID))
        // @ts-ignore
        .then(data => {
            const promises = [];
            for (const command of data) {
                const deleteUrl = `${Routes.applicationCommands(process.env.DISCORD_CLIENT_ID)}/${command.id}`;
                promises.push(rest.delete(deleteUrl));
            }
            return Promise.all(promises);
        });
    rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, '949761682165620766'), { body: commands.map(command => command.getCommand().toJSON()) })
        .then(() => console.log('Successfully registered application commands.'))
        .catch(console.error);*/

    /**
    rest.get(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, '949761682165620766'))
    // @ts-ignore
    .then(data => {
        const promises = [];
        for (const command of data) {
            const deleteUrl = `${Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID,'949761682165620766')}/${command.id}`;
            promises.push(rest.delete(deleteUrl));
        }
        return Promise.all(promises);
    });**/

    rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID || ''), { body: commands.map(command => command.getCommand().toJSON()) })
        .then(() => console.log('Successfully registered application commands.'))
        .catch(console.error);


    // When the client is ready, run this code (only once)
    client.once('ready', () => {
        client.on('interactionCreate', interaction => {
            if (!interaction.isCommand()) return;
            for (const command of commands) {
                if (command.getName() === interaction.commandName) {
                    command.executeCommand(interaction);
                    break;
                }
            }
        });
    });
}