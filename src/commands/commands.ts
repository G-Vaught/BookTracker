import { PrismaClient } from '@prisma/client';
import { ChatInputCommandInteraction, REST, Routes, SlashCommandBuilder } from 'discord.js';
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
		console.log('options', interaction.options);

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

			interaction.reply(`Added User ${user.storygraphUsername}`);
		} else {
			interaction.reply('User already exists!');
		}
	}
};

export const editUserCommand: Command = {
	name: 'edituser',
	builder: new SlashCommandBuilder(),
	handler: async (interaction: ChatInputCommandInteraction, prisma: PrismaClient) => {}
};

export const removeUserCommand: Command = {
	name: 'removeuser',
	builder: new SlashCommandBuilder(),
	handler: async (interaction: ChatInputCommandInteraction, prisma: PrismaClient) => {}
};

export const COMMANDS: Command[] = [addUserCommand];
