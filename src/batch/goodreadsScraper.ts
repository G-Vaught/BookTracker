import * as cheerio from 'cheerio';
import { Client } from 'discord.js';
import { UserWithBook } from '../models/UserWithBooks';
import { prisma } from '../services/prisma';
import { doScrapedBooksMatch, PublishAction, publishFinishedBooks, publishStartedBooks, SimpleBook } from './scraper';

const SHELF_BEGIN_URL = 'https://www.goodreads.com/review/list/';
const CURRENTLY_READING_SHELF_END = '?shelf=currently-reading';
const FINISHED_READING_SHELF_END = '?shelf=read';
const BASE_BOOK_URL = 'https://www.goodreads.com/book/show';

const BOOK_TABLE_EL_ID = '#booksBody';

const BOOK_ID_REGEX = new RegExp('[0-9]+');

export async function handleUser(user: UserWithBook, client: Client): Promise<PublishAction | undefined> {
	const userDbBooks = user.books;

	//scrape current books
	let scrapedCurrentBooks: SimpleBook[] = [];
	try {
		scrapedCurrentBooks = await scrapeCurrentBooks(user);
		const secondScrape = await scrapeCurrentBooks(user);
		if (
			!doScrapedBooksMatch(
				scrapedCurrentBooks.map(book => book.id),
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

	//scrape finished books
	let scrapedFinishedBooks: SimpleBook[] = [];
	try {
		scrapedFinishedBooks = await scrapeFinishedBooks(user);
		const secondScrape = await scrapeFinishedBooks(user);
		if (
			!doScrapedBooksMatch(
				scrapedFinishedBooks.map(b => b.id),
				secondScrape.map(b => b.id)
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

	//compare scraped current books to DB books
	const finishedBooks = userDbBooks.filter(
		dbBook => !scrapedCurrentBooks.map(currentBook => currentBook.id).includes(dbBook.id)
	);
	const newBooks = scrapedCurrentBooks.filter(scrapedBook => !userDbBooks.map(db => db.id).includes(scrapedBook.id));

	const handlePublishNewBooks = async () => {
		//if new books, handle
		if (newBooks.length > 0) {
			await publishStartedBooks(newBooks, userDbBooks, user, user.isFirstLookup, client, BASE_BOOK_URL);
		}
	}

	const handlePublishFinishedBooks = async () => {
		//if missing books and missing books are on finished list, handle
		if (finishedBooks.length > 0) {
			await publishFinishedBooks(finishedBooks, scrapedFinishedBooks, client, user, BASE_BOOK_URL);
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
		booksCount: scrapedCurrentBooks.length,
		handlePublishFinishedBooks,
		handlePublishStartedBooks: handlePublishNewBooks
	}
}

async function scrapeCurrentBooks(user: UserWithBook) {
	const fetchRes = await fetchCurrentlyReadingPage(user.dataSourceUserId);
	const fetchedBooks = await scrapeBookTable(fetchRes);
	if (fetchedBooks) {
		return fetchedBooks;
	}
	return [];
}

async function scrapeFinishedBooks(user: UserWithBook) {
	const fetchRes = await fetchFinishedReadingPage(user.dataSourceUserId);
	if (fetchRes.status !== 200) {
		throw new Error(`Fetch status returned error: ${fetchRes.status}: ${fetchRes.statusText}`);
	}
	const fetchedBooks = await scrapeBookTable(fetchRes);
	if (fetchedBooks) {
		return fetchedBooks;
	}
	return [];
}

async function scrapeBookTable(fetchRes: Response): Promise<SimpleBook[]> {
	const scrapedBooks: SimpleBook[] = [];
	const currentlyReadingBody = await fetchRes.text();

	if (!currentlyReadingBody) {
		throw new Error('Response body was empty!');
	}

	const $ = cheerio.load(currentlyReadingBody);

	const doesTableExist = $('#books')?.length > 0;
	if (!doesTableExist) {
		throw new Error('Books table does not exist! Is Goodreads under maintenance?');
	}

	const bookTableRows = $(`${BOOK_TABLE_EL_ID} > tr`);

	if (bookTableRows) {
		bookTableRows.each((i, bookTableRow) => {
			const titleEl = $('.title > .value > a', bookTableRow);
			const title = $(titleEl).attr('title')!.toString().trim();
			const idEl = $('.title > .value > a', bookTableRow);
			const href = $(idEl).attr('href')!.toString().trim();
			const id = BOOK_ID_REGEX.exec(href);
			if (id === null) {
				console.error('Error parsing href for ID');
				return;
			}
			const book: SimpleBook = {
				title,
				id: id[0]
			};
			scrapedBooks.push(book);
		});
	}
	return scrapedBooks;
}

async function fetchCurrentlyReadingPage(userId: string) {
	const url = `${SHELF_BEGIN_URL}${userId}${CURRENTLY_READING_SHELF_END}`;
	console.log('goto current url', url);
	return await fetch(url);
}

async function fetchFinishedReadingPage(userId: string) {
	const url = `${SHELF_BEGIN_URL}${userId}${FINISHED_READING_SHELF_END}`;
	console.log('goto current url', url);
	return await fetch(url);
}
