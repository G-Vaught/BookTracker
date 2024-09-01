import { APIApplicationCommandOptionChoice } from 'discord.js';

export enum DataSourceCode {
	STORYGRAPH = 'storygraph',
	GOODREADS = 'goodreads'
}

export const DataSourceCodeOptions: APIApplicationCommandOptionChoice<string>[] = [
	{ name: DataSourceCode.STORYGRAPH, value: 'storygraph' },
	{ name: DataSourceCode.GOODREADS, value: 'goodreads' }
];
