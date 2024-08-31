import { Book, User } from '@prisma/client';
import { Client, TextChannel } from 'discord.js';
import puppeteer from 'puppeteer';
import { DataSourceCode } from '../models/DataSourceCode';
import { UserWithBook as UserWithBooks } from '../models/UserWithBooks';
import { getCurrentDateTime } from '../services/log.service';
import { prisma } from '../services/prisma';
import * as goodreadsScraper from './goodreadsScraper';
import * as storygraphScraper from './storygraphScraper';

export async function scrapeBooks(client: Client) {
	let isStorygraphSignedIn = false;

	const browser = await puppeteer.launch({
		headless: true
	});
	const [page] = await browser.pages();

	const users = await prisma.user.findMany({
		include: {
			books: true
		}
	});

	const hasStorygraphUsers = users.some(user => user.dataSourceCode === DataSourceCode.STORYGRAPH);
	const hasGoodreadsUsers = users.some(user => user.dataSourceCode === DataSourceCode.GOODREADS);

	if (hasStorygraphUsers) {
		try {
			await storygraphScraper.signin(page);
			isStorygraphSignedIn = true;
		} catch (e) {
			console.log('Error occurred when signing in to Storygraph.');
			console.log(e);
			sendAdminMessage(`Error occurred when signing in to Storygraph:\n ${JSON.stringify(e)}`, client);
		}
	}

	try {
		for (const user of users) {
			if (user.dataSourceCode === DataSourceCode.STORYGRAPH && isStorygraphSignedIn) {
				await storygraphScraper.handleUser(user, client, page);
			} else if (user.dataSourceCode === DataSourceCode.GOODREADS) {
				await goodreadsScraper.handleUser(user, client);
			}
		}
	} catch (error) {
		console.log('Error fetching books', error);
		sendAdminMessage(`Error fetching books:\n ${JSON.stringify(error)}`, client);
	}

	await browser.close();
}

export async function publishStartedBooks(
	newBooks: SimpleBook[],
	currentBooks: Book[],
	user: User,
	client: Client,
	baseUrl: string
) {
	if (newBooks.length > 0) {
		console.log('New Books', newBooks);
		for (const newBook of newBooks) {
			const newDbBook = await prisma.book.create({
				data: {
					id: newBook.id,
					userId: user.id,
					title: newBook.title
				}
			});

			//Skip book if title matches current book, likely version change
			if (!user.isFirstLookup && !currentBooks.some(currentBook => newBook.title === currentBook.title)) {
				await (client.channels.cache.get(process.env.CHANNEL_ID!) as TextChannel).send(
					`${getMentionUserText(user.userId)} has started **${newBook.title}**!
                                    ${baseUrl}/${newDbBook.id}`
				);
			}
		}
	}
}

export async function publishFinishedBooks(
	finishedBooks: Book[],
	scrapedFinishedBooks: SimpleBook[],
	client: Client,
	user: User,
	baseUrl: string
) {
	console.log('Finished Books', finishedBooks);

	for (const finishedBook of finishedBooks) {
		await prisma.book.delete({
			where: {
				id_userId: {
					id: finishedBook.id,
					userId: finishedBook.userId
				}
			}
		});

		//Only show message if user has marked book as 'finished'
		if (scrapedFinishedBooks.map(book => book.id).includes(finishedBook.id)) {
			await (client.channels.cache.get(process.env.CHANNEL_ID!) as TextChannel).send(
				`${getMentionUserText(user.userId)} has finished **${finishedBook.title}**!
                                    ${baseUrl}/${finishedBook.id}`
			);
		}
	}
}

export function handleError(user: User | UserWithBooks, e: unknown, client: Client) {
	console.error(`Error scraping finished books for user ${user.dataSourceUserId}`);
	console.error(`Error: ${e}`);
	const message = `${getCurrentDateTime()} Error fetching finished books for user ${user.dataSourceUserId}\n
				\`\`\`${JSON.stringify(e)}\`\`\``;
	sendAdminMessage(message, client);
}

function sendAdminMessage(message: string, client: Client) {
	client.users.send(process.env.EKRON_USER_ID!, message);
}

export function getMentionUserText(userId: string) {
	return `<@${userId}>`;
}

export type SimpleBook = {
	id: string;
	title: string;
};
