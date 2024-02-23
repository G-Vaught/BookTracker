import { PrismaClient } from '@prisma/client';
import { ChatInputCommandInteraction, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { getMentionUserText } from '../batch/scraper';
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
	handler: async (interaction: ChatInputCommandInteraction, prisma: PrismaClient) => {
		let user = await prisma.user.findFirst({
			where: {
				userId: interaction.options.get('user')?.value as string
			}
		});

		if (!user) {
			user = await prisma.user.create({
				data: {
					userId: interaction.user.id,
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
	handler: async (interaction: ChatInputCommandInteraction, prisma: PrismaClient) => {
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

export const COMMANDS: Command[] = [addUserCommand, removeUserCommand];
