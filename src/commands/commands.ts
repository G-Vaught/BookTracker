import { ChatInputCommandInteraction, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { getMentionUserText } from '../batch/scraper';
import { prisma } from '../services/prisma';
import { Command } from './command.model';

export async function initCommands() {
	const rest = new REST({
		version: '10'
	}).setToken(process.env.DISCORD_TOKEN!);
	try {
		console.log('Registering Commands');

		await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_ID!, process.env.GUILD_ID!), {
			body: COMMANDS.map(command => command.builder.toJSON())
		});

		console.log('Registered Commmands');
	} catch (e) {
		console.error('Error registering Commands', e);
	}
}

export const addUserCommand: Command = {
	name: 'adduser',
	builder: new SlashCommandBuilder()
		.setName('adduser')
		.setDescription('Add a user by providing their username and storygraph url')
		.addMentionableOption(option => option.setName('user').setDescription('User to associate').setRequired(true))
		.addStringOption(option =>
			option.setName('storygraph-username').setDescription('Username on Storygraph').setRequired(true)
		),
	handler: async (interaction: ChatInputCommandInteraction) => {
		const userId = interaction.options.get('user')?.value as string;
		let user = await prisma.user.findFirst({
			where: {
				userId: userId
			}
		});

		if (!user) {
			user = await prisma.user.create({
				data: {
					userId: userId,
					guildId: interaction.guild!.id,
					storygraphUsername: interaction.options.get('storygraph-username')?.value as string,
					isFirstLookup: true,
					isUserFriends: false
				}
			});

			interaction.reply(`Added User ${getMentionUserText(user.userId)}`);
		} else {
			interaction.reply('User already exists!');
		}
	}
};

export const removeUserCommand: Command = {
	name: 'removeuser',
	builder: new SlashCommandBuilder()
		.setName('removeuser')
		.setDescription('Remove a User to be tracked')
		.addMentionableOption(option => option.setName('user').setDescription('User to associate').setRequired(true)),
	handler: async (interaction: ChatInputCommandInteraction) => {
		const userId = interaction.options.get('user')!.value as string;
		let user = await prisma.user.findFirst({
			where: {
				userId: userId
			}
		});

		if (!user) {
			await interaction.reply('User could not be found');
		} else {
			await prisma.user.delete({
				where: {
					id: user.id
				},
				include: {
					books: true
				}
			});

			await interaction.reply(`${getMentionUserText(userId)} has been removed`);
		}
	}
};

export const resetAllUsersCommand: Command = {
	name: 'resetusers',
	builder: new SlashCommandBuilder()
		.setName('resetusers')
		.setDescription('WARNING: Remove all books and set all users as new users'),
	handler: async (interaction: ChatInputCommandInteraction) => {
		if (interaction.user.id !== process.env.EKRON_USER_ID) {
			interaction.reply('You do not have permissions to use this command');
			return;
		}

		await prisma.book.deleteMany();

		await prisma.user.updateMany({
			data: {
				isFirstLookup: true
			}
		});

		interaction.reply('Reset all users.');
	}
};

export const listUsersAndBooks: Command = {
	name: 'listusers',
	builder: new SlashCommandBuilder().setName('listusers').setDescription('List users and their current books'),
	handler: async (interaction: ChatInputCommandInteraction) => {
		let fullMessage = '```';
		const users = await prisma.user.findMany();
		for (const user of users) {
			const books = await prisma.book.findMany({
				where: {
					userId: user.id
				}
			});
			let msg = `${user.storygraphUsername}: \n`;
			books.forEach(book => (msg += `\t${book.title}\n`));
			fullMessage += msg;
		}
		fullMessage += '```';
		interaction.reply(fullMessage);
	}
};

export const COMMANDS: Command[] = [addUserCommand, removeUserCommand, resetAllUsersCommand, listUsersAndBooks];
