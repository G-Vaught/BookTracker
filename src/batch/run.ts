import Cron from 'croner';
import { Client } from 'discord.js';
import { getCurrentDateTime } from '../services/log.service';
import { scrapeBooks } from './scraper';

export function runBatch(client: Client) {
	const job = new Cron(
		'*/15 * * * *', //Every 15 minutes
		{
			timezone: 'America/Chicago'
		},
		async () => {
			console.log('Starting batch at', getCurrentDateTime());
			try {
				await scrapeBooks(client);
			} catch (e) {
				console.error("Error during batch run: ", e);
			}
			console.log('Finished batch at', getCurrentDateTime());
		}
	);
}
