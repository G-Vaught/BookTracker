import { PrismaClient, User } from '@prisma/client';
import { Client, TextChannel } from 'discord.js';
import puppeteer, { Page } from 'puppeteer';

const BASE_STORYGRAPH_URL = 'https://app.thestorygraph.com';
const SIGNIN_URL = `${BASE_STORYGRAPH_URL}/users/sign_in`;
const BASE_CURRENT_READING_URL = `${BASE_STORYGRAPH_URL}/currently-reading`;
const BASE_BOOK_URL = `${BASE_STORYGRAPH_URL}/books`;

const signin_email_id = '#user_email';
const signin_password_id = '#user_password';
const signin_submit_id = '#sign-in-btn';

export async function scrapeBooks(client: Client) {
	const prisma = new PrismaClient();
	const browser = await puppeteer.launch({ headless: true });
	const [page] = await browser.pages();
	await signin(page);

	await handleUsers(prisma, page, client);

	await browser.close();

	await prisma.$disconnect();
}

async function handleUsers(prisma: PrismaClient, page: Page, client: Client) {
	try {
		const users = await prisma.user.findMany({
			include: {
				books: true
			}
		});
		for (const user of users) {
			const dbBooks = user.books;
			await page.goto(`${BASE_CURRENT_READING_URL}/${user.storygraphUsername}`);
			const books = await fetchBooksByUser(user, prisma, page, client);
			const currentBooks = dbBooks.filter(db => books.map(book => book.id).includes(db.id));
			const finishedBooks = dbBooks.filter(dbBook => !books.map(book => book.id).includes(dbBook.id));
			const newBooks = books.filter(book => !dbBooks.map(db => db.id).includes(book.id));
			// const finishedBooks = dbBooks.filter(dbBook => !books.map(book => book.id).includes(dbBook.id));
			console.log('user', user.storygraphUsername);
			console.log('current books', currentBooks);
			console.log('finished books', finishedBooks);
			console.log('new books', newBooks);

			if (newBooks) {
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
			if (finishedBooks) {
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

export function getMentionUserText(userId: string) {
	return `<@${userId}>`;
}

async function fetchBooksByUser(user: User, prisma: PrismaClient, page: Page, client: Client) {
	/*
    Use class 'read-books-panes' to find book divs
    For each div in span, get book id with attr 'data-book-id' along with other info
    OPTIONAL Use 'progress-tracker-pane' to try and get read %. 
    */
	const books: Book[] = [];
	await page.waitForSelector('.read-books-panes');
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
