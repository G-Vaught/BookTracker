import { PrismaClient } from '@prisma/client';
import { ApplicationCommandOptionType, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export type Command = {
	name: string;
	builder: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
	handler: (interaction: ChatInputCommandInteraction, prisma: PrismaClient) => void;
};

export type Option = {
	name: string;
	description?: string;
	type?: ApplicationCommandOptionType;
};
