import Cron from 'croner';
import { Client } from 'discord.js';
import { scrapeBooks } from './scraper';

export function runBatch(client: Client) {
	const job = new Cron(
		'*/5 * * * *', //Every 5 minutes
		{
			timezone: 'America/Chicago'
		},
		async () => {
			console.log('Starting batch at', new Date().toLocaleString());
			await scrapeBooks(client);
			console.log('Finished batch at', new Date().toLocaleString());
		}
	);
}
