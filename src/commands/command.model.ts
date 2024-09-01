import {
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder
} from 'discord.js';

export type Command = {
	name: string;
	builder:
		| SlashCommandBuilder
		| SlashCommandOptionsOnlyBuilder
		| Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
	handler: (interaction: ChatInputCommandInteraction) => void;
};

export type Option = {
	name: string;
	description?: string;
	type?: ApplicationCommandOptionType;
};
