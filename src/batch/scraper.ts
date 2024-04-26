import { Book, User } from '@prisma/client';
import { Client, TextChannel } from 'discord.js';
import puppeteer, { Page } from 'puppeteer';
import { getCurrentDateTime } from '../services/log.service';
import { prisma } from '../services/prisma';

const BASE_STORYGRAPH_URL = 'https://app.thestorygraph.com';
const SIGNIN_URL = `${BASE_STORYGRAPH_URL}/users/sign_in`;
const BASE_CURRENT_READING_URL = `${BASE_STORYGRAPH_URL}/currently-reading`;
const BASE_BOOK_URL = `${BASE_STORYGRAPH_URL}/books`;
const FINISHED_BOOKS_URL = `${BASE_STORYGRAPH_URL}/books-read`;

const signin_email_id = '#user_email';
const signin_password_id = '#user_password';
const signin_submit_id = '#sign-in-btn';

export async function scrapeBooks(client: Client) {
	const browser = await puppeteer.launch({ headless: true });
	const [page] = await browser.pages();

	try {
		await signin(page);
	} catch (e) {
		console.log('Error occurred when signing in.');
		console.log(e);
		await browser.close();
		return;
	}

	await handleUsers(page, client);

	await browser.close();
}

async function handleUsers(page: Page, client: Client) {
	try {
		const users = await prisma.user.findMany({
			include: {
				books: true
			}
		});
		for (const user of users) {
			const dbBooks = user.books;
			let books: SimpleBook[];
			try {
				books = await scrapePageBooks(BASE_CURRENT_READING_URL, user, page);
			} catch (e) {
				handleError(user, e, client);
				continue;
			}
			const finishedBooks = dbBooks.filter(dbBook => !books.map(book => book.id).includes(dbBook.id));
			const newBooks = books.filter(book => !dbBooks.map(db => db.id).includes(book.id));

			await publishStartedBooks(newBooks, user, client);

			await publishFinishedBooks(finishedBooks, client, user, page);

			if (user.isFirstLookup) {
				await prisma.user.update({
					where: {
						id: user.id
					},
					data: {
						isFirstLookup: false
					}
				});
			}
		}
	} catch (error) {
		console.log('Error fetching books', error);
	}
}

async function publishFinishedBooks(finishedBooks: Book[], client: Client, user: User, page: Page) {
	if (finishedBooks.length > 0) {
		console.log('Finished Books', finishedBooks);

		let scrapedFinishedBooks: SimpleBook[] = [];
		try {
			scrapedFinishedBooks = await scrapePageBooks(FINISHED_BOOKS_URL, user, page);
		} catch (e) {
			handleError(user, e, client);
			return;
		}

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
							${BASE_BOOK_URL}/${finishedBook.id}`
				);
			}
		}
	}
}

function handleError(user: User, e: unknown, client: Client) {
	console.error(`Error scraping finished books for user ${user.storygraphUsername}`);
	console.error(`Error: ${e}`);
	const message = `${getCurrentDateTime()} Error fetching finished books for user ${user.storygraphUsername}\n
				\`\`\`${JSON.stringify(e)}\`\`\``;
	client.users.send(process.env.EKRON_USER_ID!, message);
}

async function scrapePageBooks(url: string, user: User, page: Page) {
	const scrapedBooks: SimpleBook[] = [];

	console.log(`Starting scrape for user ${user.storygraphUsername}`);
	await page.goto(`${url}/${user.storygraphUsername}`);
	await page.waitForSelector('main');
	if (!(await page.$('.read-books-panes'))) {
		console.log('Book panes return null, no current books found');
		return scrapedBooks;
	}

	const bookPanes = await page.$$('.read-books-panes > div');

	console.log(`Found ${bookPanes.length + 1} book pane(s)`);

	for (const bookPane of bookPanes) {
		const bookId = await bookPane.evaluate(el => el.getAttribute('data-book-id'));
		const bookTitle = (await page.evaluate(
			el => el.querySelector('.book-title-author-and-series a')?.textContent,
			bookPane
		)) as string;
		scrapedBooks.push({
			id: bookId!,
			title: bookTitle
		});
	}

	console.log(`Finished scraping books for user ${user.storygraphUsername}`);

	return scrapedBooks;
}

async function publishStartedBooks(newBooks: SimpleBook[], user: User, client: Client) {
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

			if (!user.isFirstLookup) {
				await (client.channels.cache.get(process.env.CHANNEL_ID!) as TextChannel).send(
					`${getMentionUserText(user.userId)} has started **${newBook.title}**!
                            ${BASE_BOOK_URL}/${newDbBook.id}`
				);
			}
		}
	}
}

export function getMentionUserText(userId: string) {
	return `<@${userId}>`;
}

type SimpleBook = {
	id: string;
	title: string;
};

async function signin(page: Page) {
	await page.goto(SIGNIN_URL);
	await page.waitForSelector(signin_email_id);
	await page.type(signin_email_id, process.env.STORYGRAPH_EMAIL!);
	await page.type(signin_password_id, process.env.STORYGRAPH_PASSWORD!);
	await Promise.all([page.click(signin_submit_id), page.waitForNavigation()]);
}
