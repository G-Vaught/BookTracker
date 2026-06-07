import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { runBatch } from './batch/run';
import { Command } from './commands/command.model';
import { COMMANDS, initCommands } from './commands/commands';
require('dotenv').config();
require('./services/log.service');

//Set virtual display
process.env.DISPLAY = ':1';

const token = process.env.DISCORD_TOKEN;

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

const commands = new Collection<string, Command>();

COMMANDS.forEach(command => commands.set(command.name, command));

initCommands();

client.once(Events.ClientReady, readyClient => {
	console.log('Client Ready');
	runBatch(readyClient);
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = commands.get(interaction.commandName);

	try {
		command?.handler(interaction);
	} catch (error) {
		console.log('Error executing command', error);
		interaction.reply('Error executing command');
	}
});

client.on('error', error => {
	console.error("Error event: ", error);
});

client.on('shardError', error => {
	console.error('Shard error event: ', error);
});

process.on('uncaughtException', error => {
	console.error("Uncaught exception event: ", error);
	//Maybe try to reconnect here, or restart pm2 process
});

client.login(token);
