import { Book, User } from '@prisma/client';
import { Client } from 'discord.js';
import { Page } from 'puppeteer';
import { UserWithBook } from '../models/UserWithBooks';
import { prisma } from '../services/prisma';
import { SimpleBook, handleError, publishFinishedBooks, publishStartedBooks } from './scraper';

const BASE_STORYGRAPH_URL = 'https://app.thestorygraph.com';
const SIGNIN_URL = `${BASE_STORYGRAPH_URL}/users/sign_in`;
const BASE_CURRENT_READING_URL = `${BASE_STORYGRAPH_URL}/currently-reading`;
const BASE_BOOK_URL = `${BASE_STORYGRAPH_URL}/books`;
const FINISHED_BOOKS_URL = `${BASE_STORYGRAPH_URL}/books-read`;

const signin_email_id = '#user_email';
const signin_password_id = '#user_password';
const signin_submit_id = '#sign-in-btn';

export async function signin(page: Page) {
	await page.bringToFront();
	await page.goto(SIGNIN_URL);
	await page.waitForSelector(signin_email_id);
	await page.type(signin_email_id, process.env.STORYGRAPH_EMAIL!);
	await page.type(signin_password_id, process.env.STORYGRAPH_PASSWORD!);
	await Promise.all([page.click(signin_submit_id), page.waitForNavigation()]);
}

export async function handleUser(user: UserWithBook, client: Client, page: Page) {
	const dbBooks = user.books;
	let books: SimpleBook[];
	try {
		books = await scrapePageBooks(BASE_CURRENT_READING_URL, user, page);
	} catch (e) {
		handleError(user, e, client);
		return;
	}
	const finishedBooks = dbBooks.filter(dbBook => !books.map(book => book.id).includes(dbBook.id));
	const newBooks = books.filter(book => !dbBooks.map(db => db.id).includes(book.id));

	await publishStartedBooks(newBooks, dbBooks, user, client, BASE_BOOK_URL);

	await handleFinishedBooks(finishedBooks, client, user, page);

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

async function handleFinishedBooks(finishedBooks: Book[], client: Client, user: User, page: Page) {
	if (finishedBooks.length > 0) {
		let scrapedFinishedBooks: SimpleBook[] = [];
		try {
			scrapedFinishedBooks = await scrapePageBooks(FINISHED_BOOKS_URL, user, page);
		} catch (e) {
			handleError(user, e, client);
			return;
		}

		await publishFinishedBooks(finishedBooks, scrapedFinishedBooks, client, user, BASE_BOOK_URL);
	}
}

async function scrapePageBooks(url: string, user: User, page: Page) {
	const scrapedBooks: SimpleBook[] = [];

	console.log(`Starting scrape for user ${user.dataSourceUserId}`);
	await page.goto(`${url}/${user.dataSourceUserId}`);
	console.log(`Page navigated to url: ${page.url()}`);
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

	console.log(`Finished scraping books for user ${user.dataSourceUserId}`);

	return scrapedBooks;
}