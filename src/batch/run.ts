import Cron from 'croner';
import { Client } from 'discord.js';
import { scrapeBooks } from './scraper';

export function runBatch(client: Client) {
	const job = new Cron(
		'*/15 * * * *', //Every 15 minutes
		{
			timezone: 'America/Chicago'
		},
		async () => {
			console.log('Starting batch at', new Date().toLocaleString('en-US'));
			await scrapeBooks(client);
			console.log('Finished batch at', new Date().toLocaleString('en-US'));
		}
	);
}
