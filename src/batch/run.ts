import { CronJob } from 'cron';
import { Client } from 'discord.js';
import { scrapeBooks } from './scraper';

export function runBatch(client: Client) {
	const updateBooks = new CronJob(
		'*/30 * * * *', //Every 30 minutes
		async () => {
			console.log('Starting batch at', new Date().toLocaleString());
			await scrapeBooks(client);
			console.log('Finished batch at', new Date().toLocaleString());
		},
		null,
		true,
		'America/Chicago'
	);
}
