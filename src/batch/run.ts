import { CronJob } from 'cron';
import { Client } from 'discord.js';
import { log } from '../services/log.service';
import { scrapeBooks } from './scraper';

export function runBatch(client: Client) {
	const updateBooks = new CronJob(
		'*/5 * * * *', //Every 5 minutes
		async () => {
			log('Starting batch at', new Date().toLocaleString());
			await scrapeBooks(client);
			log('Finished batch at', new Date().toLocaleString());
		},
		null,
		true,
		'America/Chicago'
	);
}
