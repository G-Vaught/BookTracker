import { PrismaClient, User } from '@prisma/client';
import { Client, TextChannel } from 'discord.js';
import puppeteer, { Page } from 'puppeteer';
import { prisma } from '../services/prisma';

const BASE_STORYGRAPH_URL = 'https://app.thestorygraph.com';
const SIGNIN_URL = `${BASE_STORYGRAPH_URL}/users/sign_in`;
const BASE_CURRENT_READING_URL = `${BASE_STORYGRAPH_URL}/currently-reading`;
const BASE_BOOK_URL = `${BASE_STORYGRAPH_URL}/books`;

const signin_email_id = '#user_email';
const signin_password_id = '#user_password';
const signin_submit_id = '#sign-in-btn';

export async function scrapeBooks(client: Client) {
	const browser = await puppeteer.launch({ headless: true });
	const [page] = await browser.pages();
	await signin(page);

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
			console.log('user', user.storygraphUsername);
			let books: Book[];
			try {
				await page.goto(`${BASE_CURRENT_READING_URL}/${user.storygraphUsername}`);
				books = await fetchBooksByUser(user, prisma, page, client);
			} catch (e) {
				console.error(`Error fetching books for user ${user.storygraphUsername}... Skipping`);
				console.error('Error: ', e);
				continue;
			}
			const finishedBooks = dbBooks.filter(dbBook => !books.map(book => book.id).includes(dbBook.id));
			const newBooks = books.filter(book => !dbBooks.map(db => db.id).includes(book.id));

			await publishCompletedBooks(newBooks, user, client);

			await publishFinishedBooks(finishedBooks, client, user);

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

async function publishFinishedBooks(
	finishedBooks: { id: string; title: string; userId: string; creationDate: Date; updatedDate: Date }[],
	client: Client<boolean>,
	user: { books: { id: string; title: string; userId: string; creationDate: Date; updatedDate: Date }[] } & {
		id: string;
		userId: string;
		guildId: string;
		storygraphUsername: string;
		isUserFriends: boolean;
		isFirstLookup: boolean;
		creationDate: Date;
		updatedDate: Date;
	}
) {
	if (finishedBooks) {
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

			await (client.channels.cache.get(process.env.CHANNEL_ID!) as TextChannel).send(
				`${getMentionUserText(user.userId)} has finished **${finishedBook.title}**!
					    ${BASE_BOOK_URL}/${finishedBook.id}`
			);
		}
	}
}

async function publishCompletedBooks(
	newBooks: Book[],
	user: { books: { id: string; title: string; userId: string; creationDate: Date; updatedDate: Date }[] } & {
		id: string;
		userId: string;
		guildId: string;
		storygraphUsername: string;
		isUserFriends: boolean;
		isFirstLookup: boolean;
		creationDate: Date;
		updatedDate: Date;
	},
	client: Client<boolean>
) {
	if (newBooks) {
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

async function fetchBooksByUser(user: User, prisma: PrismaClient, page: Page, client: Client) {
	/*
    Use class 'read-books-panes' to find book divs
    For each div in span, get book id with attr 'data-book-id' along with other info
    */
	const books: Book[] = [];
	await page.waitForSelector('main');
	if (!(await page.$('.read-books-panes'))) {
		console.log('No books currently reading');
		return books;
	}

	const bookDivs = await page.$$('.read-books-panes > div');
	for (const bookDiv of bookDivs) {
		const bookId = await bookDiv.evaluate(el => el.getAttribute('data-book-id'));
		const bookTitle = (await page.evaluate(
			el => el.querySelector('.book-title-author-and-series a')?.textContent,
			bookDiv
		)) as string;
		books.push({
			id: bookId!,
			title: bookTitle
		});
	}
	return books;
}

type Book = {
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
