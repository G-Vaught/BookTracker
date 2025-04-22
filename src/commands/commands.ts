import { ChatInputCommandInteraction, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { getMentionUserText } from '../batch/scraper';
import { DataSourceCode, DataSourceCodeOptions } from '../models/DataSourceCode';
import { prisma } from '../services/prisma';
import { Command } from './command.model';
import { isScraperEnabled, toggleScraper } from '../services/configService';

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
		.setDescription('Add a user by providing their Discord user, what website they use, and provide their ID')
		.addMentionableOption(option => option.setName('user').setDescription('User to associate').setRequired(true))
		.addStringOption(option =>
			option
				.setName('data-source')
				.setDescription('Choose what site user uses')
				.addChoices(...DataSourceCodeOptions)
				.setRequired(true)
		)
		.addStringOption(option =>
			option
				.setName('data-source-user-id')
				.setDescription('Username on Storygraph or Goodreads')
				.setRequired(true)
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
					dataSourceUserId: interaction.options.get('data-source-user-id')?.value as string,
					dataSourceCode: interaction.options.get('data-source')?.value as string,
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

export const changeUserDataSourceCommand: Command = {
	name: 'changeuserdatasource',
	builder: new SlashCommandBuilder()
		.setName('changeuserdatasource')
		.setDescription('Change users data source, either Storygraph or Goodreads')
		.addMentionableOption(option => option.setName('user').setDescription('User to change').setRequired(true))
		.addStringOption(option =>
			option
				.setName('data-source')
				.setDescription('Choose what site user uses')
				.addChoices(...DataSourceCodeOptions)
				.setRequired(true)
		)
		.addStringOption(option =>
			option.setName('data-source-user-id').setDescription('Username for new data source').setRequired(true)
		),
	handler: async (interaction: ChatInputCommandInteraction) => {
		const user = interaction.options.getUser('user');
		if (user === null) {
			interaction.reply('User must be supplied');
			return;
		}
		const newDataSourceCode = interaction.options.getString('data-source');
		if (newDataSourceCode === null) {
			interaction.reply('Data source must be supplied');
			return;
		}
		const dbUser = await prisma.user.findFirst({
			where: {
				userId: user.id
			}
		});
		const newDataSourceUserId = interaction.options.getString('data-source-user-id');
		if (!newDataSourceUserId) {
			interaction.reply('New data source user ID must be provided');
			return;
		}

		if (!dbUser) {
			interaction.reply('User does not exist!');
		} else {
			if (dbUser.dataSourceCode === newDataSourceCode) {
				interaction.reply('User is already using that data source!');
			} else {
				await prisma.$transaction([
					prisma.user.update({
						where: {
							id: dbUser.id
						},
						data: {
							dataSourceCode: newDataSourceCode,
							dataSourceUserId: newDataSourceUserId,
							isFirstLookup: true
						}
					}),
					prisma.book.deleteMany({
						where: {
							userId: dbUser.id
						}
					})
				]);

				interaction.reply(`User has been updated to use ${newDataSourceCode}`);
			}
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
			let msg = `${user.dataSourceUserId} - ${user.dataSourceCode}: \n`;
			books.forEach(book => (msg += `\t${book.title}\n`));
			fullMessage += msg;
		}
		fullMessage += '```';
		interaction.reply(fullMessage);
	}
};

export const resetUser: Command = {
	name: 'resetuser',
	builder: new SlashCommandBuilder().setName('resetuser').setDescription('Remove a user\'s current reading list, WITHOUT resetting isFirstLookup')
		.addMentionableOption(option => option.setName('user').setDescription('User to reset').setRequired(true)),
	handler: async (interaction: ChatInputCommandInteraction) => {
		if (interaction.user.id !== process.env.EKRON_USER_ID) {
			interaction.reply('You do not have permissions to use this command');
			return;
		}

		const user = interaction.options.getUser('user');
		if (user === null) {
			interaction.reply('User must be supplied');
			return;
		}

		const dbUser = await prisma.user.findFirst({
			where: {
				userId: user.id
			}
		});

		if (!dbUser) {
			return;
		}

		await prisma.book.deleteMany({
			where: {
				userId: dbUser.id
			}
		});

		console.log(`Reset ${user.username}\'s books`);

		interaction.reply(`Reset ${user.username}\'s books`);
	}
}

export const toggleStorygraphScraperCommand: Command = {
	name: 'togglestorygraph',
	builder: new SlashCommandBuilder()
		.setName('togglestorygraph')
		.setDescription('Toggle Storygraph scraper on or off'),
	handler: async (interaction: ChatInputCommandInteraction) => {
		toggleScraper(DataSourceCode.STORYGRAPH);
		console.log('Toggle Storygraph scraper, new value is', isScraperEnabled(DataSourceCode.STORYGRAPH));
		interaction.reply(`Storygraph scraper is now ${isScraperEnabled(DataSourceCode.STORYGRAPH) ? 'enabled': 'disabled'}`)
	}
}

export const toggleGoodreadsScraperCommand: Command = {
	name: 'togglegoodreads',
	builder: new SlashCommandBuilder()
		.setName('togglegoodreads')
		.setDescription('Toggle Goodreads scraper on or off'),
	handler: async (interaction: ChatInputCommandInteraction) => {
		toggleScraper(DataSourceCode.GOODREADS);
		console.log('Toggle Goodreads scraper, new value is', isScraperEnabled(DataSourceCode.GOODREADS));
		interaction.reply(`Goodreads scraper is now ${isScraperEnabled(DataSourceCode.GOODREADS) ? 'enabled': 'disabled'}`)
	}
}

export const COMMANDS: Command[] = [
	addUserCommand,
	removeUserCommand,
	resetAllUsersCommand,
	changeUserDataSourceCommand,
	listUsersAndBooks,
	resetUser,
	toggleStorygraphScraperCommand,
	toggleGoodreadsScraperCommand
];
