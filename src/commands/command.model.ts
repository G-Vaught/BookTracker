import {
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder
} from 'discord.js';

export type Command = {
	name: string;
	builder: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
	handler: (interaction: ChatInputCommandInteraction) => void;
};

export type Option = {
	name: string;
	description?: string;
	type?: ApplicationCommandOptionType;
};
