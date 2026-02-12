import { User } from '@prisma/client';
import { Client } from 'discord.js';
import { Page } from 'puppeteer';
import { UserWithBook } from '../models/UserWithBooks';
import { prisma } from '../services/prisma';
import { PublishAction, SimpleBook, doScrapedBooksMatch, publishFinishedBooks, publishStartedBooks } from './scraper';

const BASE_STORYGRAPH_URL = 'https://app.thestorygraph.com';
const SIGNIN_URL = `${BASE_STORYGRAPH_URL}/users/sign_in`;
const BASE_CURRENT_READING_URL = `${BASE_STORYGRAPH_URL}/currently-reading`;
const BASE_BOOK_URL = `${BASE_STORYGRAPH_URL}/books`;
const FINISHED_BOOKS_URL = `${BASE_STORYGRAPH_URL}/books-read`;

const signin_email_id = '#user_email';
const signin_password_id = '#user_password';
const signin_submit_id = '#sign-in-btn';

export async function signin(page: Page, CLOUDFLARE_CAPTCHA_ENABLED: boolean) {
	await page.bringToFront();
	await page.goto(SIGNIN_URL, {waitUntil: 'networkidle2'});
	if (CLOUDFLARE_CAPTCHA_ENABLED) {
		await page.waitForResponse(SIGNIN_URL);
	}
	await page.waitForSelector(signin_email_id);
	await page.type(signin_email_id, process.env.STORYGRAPH_EMAIL!);
	await page.type(signin_password_id, process.env.STORYGRAPH_PASSWORD!);
	await Promise.all([page.click(signin_submit_id), page.waitForNavigation()]);
}

export async function handleUser(user: UserWithBook, client: Client, page: Page): Promise<PublishAction | undefined> {
	const dbBooks = user.books;
	let books: SimpleBook[] = [];
	try {
		books = await scrapePageBooks(BASE_CURRENT_READING_URL, user, page);
		const secondScrape = await scrapePageBooks(BASE_CURRENT_READING_URL, user, page);
		if (
			!doScrapedBooksMatch(
				books.map(book => book.id),
				secondScrape.map(book => book.id)
			)
		) {
			console.error('Current books scrape returned different results, skipping user');
			return;
		}
	} catch (e) {
		console.error(`Error fetch current books for user ${user.dataSourceUserId}`);
		console.error(e);
		throw e;
	}

	let scrapedFinishedBooks: SimpleBook[];
	try {
		scrapedFinishedBooks = await scrapePageBooks(FINISHED_BOOKS_URL, user, page);
		const secondScrape = await scrapePageBooks(FINISHED_BOOKS_URL, user, page);
		if (
			!doScrapedBooksMatch(
				books.map(book => book.id),
				secondScrape.map(book => book.id)
			)
		) {
			console.error('Finished books scrape returned different results, skipping user');
			return;
		}
	} catch (e) {
		console.error(`Error fetch finished books for user ${user.dataSourceUserId}`);
		console.error(e);
		throw e;
	}

	const finishedBooks = dbBooks.filter(dbBook => !books.map(book => book.id).includes(dbBook.id));
	const newBooks = books.filter(book => !dbBooks.map(db => db.id).includes(book.id));

	let handlePublishStartedBooks = async () => {
		if (newBooks.length > 0) {
			await publishStartedBooks(newBooks, dbBooks, user, user.isFirstLookup, client, BASE_BOOK_URL);
		}
	}

	let handlePublishFinishedBooks = async () => {
		if (finishedBooks.length > 0) {
			await publishFinishedBooks(finishedBooks, scrapedFinishedBooks, client, user, BASE_BOOK_URL)
		}
	}

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

	return {
		booksCount: books.length,
		handlePublishStartedBooks,
		handlePublishFinishedBooks
	};
}

async function scrapePageBooks(url: string, user: User, page: Page) {
	const scrapedBooks: SimpleBook[] = [];

	await page.goto(`${url}/${user.dataSourceUserId}`);
	console.log(`Page navigated to url: ${page.url()}`);
	await page.waitForSelector('main');
	if (!(await page.$('.read-books-panes'))) {
		console.log('Book panes return null, no current books found');
		return scrapedBooks;
	}

	const bookPanes = await page.$$('.read-books-panes > div');

	console.log(`Found ${bookPanes.length} book pane(s)`);

	for (const bookPane of bookPanes) {
		const bookId = await bookPane.evaluate(el => el.getAttribute('data-book-id'));
		const bookTitle = (await page.evaluate(
			el => el.querySelector('.book-title-author-and-series h3 a')?.textContent,
			bookPane
		)) as string;
		const coverUrl = await bookPane.evaluate(el => el.querySelector('img')?.src) || '';
		scrapedBooks.push({
			id: bookId!,
			title: bookTitle,
			imgUrl: coverUrl
		});
	}

	return scrapedBooks;
}
