import * as cheerio from 'cheerio';
import { Client } from 'discord.js';
import { UserWithBook } from '../models/UserWithBooks';
import { prisma } from '../services/prisma';
import { doScrapedBooksMatch, PublishAction, publishFinishedBooks, publishStartedBooks, SimpleBook, UserResult } from './scraper';
import { Page } from 'puppeteer';
import { User } from '@prisma/client';

const SIGNIN_URL = 'https://www.goodreads.com/user/sign_in';

const SHELF_BEGIN_URL = 'https://www.goodreads.com/review/list/';
const CURRENTLY_READING_SHELF_END = '?shelf=currently-reading';
const FINISHED_READING_SHELF_END = '?shelf=read';
const BASE_BOOK_URL = 'https://www.goodreads.com/book/show';

const GOTO_SIGNIN_BTN = '#choices > div > a:nth-child(4) > button'
const signin_email_id = '#ap_email';
const signin_password_id = '#ap_password';
const signin_submit_id = '#signInSubmit';

const SIGNIN_EMAIL = process.env.GOODREADS_EMAIL!;
const SIGNIN_PASS = process.env.GOODREADS_PASSWORD!;

export async function signin(page: Page, CLOUDFLARE_CAPTCHA_ENABLED: boolean) {
	await page.bringToFront();
	await page.goto(SIGNIN_URL, { waitUntil: 'networkidle2' });
	if (CLOUDFLARE_CAPTCHA_ENABLED) {
		await page.waitForResponse(SIGNIN_URL);
	}
	await page.click(GOTO_SIGNIN_BTN);
	await page.waitForSelector(signin_email_id);
	await page.type(signin_email_id, SIGNIN_EMAIL);
	await page.type(signin_password_id, SIGNIN_PASS!);
	await Promise.all([page.click(signin_submit_id), page.waitForNavigation()]);
	await page.waitForSelector('.gr-mainContentContainer');
}

export async function handleUser(user: UserWithBook, client: Client, page: Page): Promise<PublishAction | undefined> {
	const dbBooks = user.books;
	let books: SimpleBook[] = [];
	try {
		books = await scrapePageBooks(getCurrentReadingShelfURL(user), user, page);
		const secondScrape = await scrapePageBooks(getCurrentReadingShelfURL(user), user, page);
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
		scrapedFinishedBooks = await scrapePageBooks(getFinishedReadingShelfURL(user), user, page);
		const secondScrape = await scrapePageBooks(getFinishedReadingShelfURL(user), user, page);
		if (
			!doScrapedBooksMatch(
				scrapedFinishedBooks.map(book => book.id),
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

export async function scrapeCurrentPage(user: UserWithBook, page: Page) {
	return scrapePageBooks(getCurrentReadingShelfURL(user), user, page);
}

export async function scrapeFinishedPage(user: UserWithBook, page: Page) {
	return scrapePageBooks(getFinishedReadingShelfURL(user), user, page);
}

export async function handleUsersBooks(user: UserWithBook, result: UserResult, client: Client) {
	const dbBooks = user.books;
	if (
		!doScrapedBooksMatch(
			result.currentResult1.map(book => book.id),
			result.currentResult2.map(book => book.id)
		)
	) {
		console.error(`${user.dataSourceUserId} - Current books scrape returned different results, skipping user`);
		return;
	}

	if (
		!doScrapedBooksMatch(
			result.finishedResult1.map(book => book.id),
			result.finishedResult2.map(book => book.id)
		)
	) {
		console.error(`${user.dataSourceUserId} - Finished books scrape returned different results, skipping user`);
		return;
	}

	const books = result.currentResult1;
	const finishedBooks = dbBooks.filter(dbBook => !books.map(book => book.id).includes(dbBook.id));
	const newBooks = books.filter(book => !dbBooks.map(db => db.id).includes(book.id));

	if (finishedBooks.some(finishedBook => result.currentResult1.map(current => current.id).includes(finishedBook.id))) {
		console.error(`${user.dataSourceUserId} - Finished books contain current books, something went wrong. Skipping user`);
		console.log(`${user.dataSourceUserId} - Invalid result:`, result);
		return;
	}

	let handlePublishStartedBooks = async () => {
		if (newBooks.length > 0) {
			await publishStartedBooks(newBooks, dbBooks, user, user.isFirstLookup, client, BASE_BOOK_URL);
		}
	}

	let handlePublishFinishedBooks = async () => {
		if (finishedBooks.length > 0) {
			await publishFinishedBooks(finishedBooks, result.finishedResult1, client, user, BASE_BOOK_URL)
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

	await page.goto(`${url}`);
	console.log(`${user.dataSourceUserId} - Page navigated to url: ${page.url()}`);
	if (page.url() !== `${url}`) {
		throw new Error(`${user.dataSourceUserId} - Page URL ${page.url()} does not match expected URL`);
	}
	await page.waitForSelector('.mainContent');
	const readBookPanes = await page.$$('#booksBody');
	if (readBookPanes === undefined || readBookPanes === null) {
		throw new Error(`Error getting read-book-panes, ${readBookPanes}`);
	} else if (readBookPanes.length === 0) {
		console.log('${user.userId} - Book panes return null, no current books found');
		return scrapedBooks;
	}

	//td.field.cover > div > div > a
	const bookRows = await page.$$('#booksBody > tr');
	console.log(`${user.dataSourceUserId} - Found ${bookRows.length} book pane(s)`);
	for (const bookRow of bookRows) {
		const [bookShortUrl, bookTitle] = await bookRow.$eval('td.field.title > div > a', (a) => [a.getAttribute('href'), a.textContent]);
		const cleanTitle = bookTitle?.replace(/^\n\s+/, '').replace(/\n$/, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
		const bookShort = bookShortUrl?.match(/\/book\/show\/(\d+)/);
		const bookId = bookShort?.[1];

		let coverUrl = await bookRow.$eval('td.field.cover > div > div > a > img', img => img.getAttribute('src'));
		if (coverUrl?.includes('_SY75_') || coverUrl?.includes('_SX50_')) {
			coverUrl = coverUrl.substring(0, coverUrl.length - 11) + '.jpg';
		} else if (coverUrl?.includes('_SX50_SY75_')) {
			coverUrl = coverUrl.substring(0, coverUrl.length - 16) + '.jpg';
		}

		if (bookId && cleanTitle && coverUrl) {
			scrapedBooks.push({
				id: bookId,
				title: cleanTitle,
				imgUrl: coverUrl,
				user: user.id
			});
		}
	}

	return scrapedBooks;
}

function getCurrentReadingShelfURL(user: UserWithBook) {
	return `${SHELF_BEGIN_URL}${user.dataSourceUserId}${CURRENTLY_READING_SHELF_END}`
}

function getFinishedReadingShelfURL(user: UserWithBook) {
	return `${SHELF_BEGIN_URL}${user.dataSourceUserId}${FINISHED_READING_SHELF_END}`
}