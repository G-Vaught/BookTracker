import OpenAI from "openai";
import puppeteer, { Browser, Page } from 'puppeteer';

const reviewerPersonalities = [
    'sarcastic without being cringy',
    'thoughtful and witty'
]

export const reviewBook = async (title: string) => {
    const client = new OpenAI({
        baseURL: "http://192.168.1.14:1234/v1",
        apiKey: "lm-studio"
    });


    const [parsedTitle, tags, description] = await fetchBookAndParse(title);
    console.log(parsedTitle, tags, description);
    if (!parsedTitle || !tags || !description) {
        console.log('Error fetching book info for review');
        return;   
    }

    const review = await fetchOpenAiReview(parsedTitle, tags, description, client);
    if (review) {
        return review;
    } else {
        console.log('Error fetching openai review');
        return;
    }
}

const fetchBookAndParse = async (title: string): Promise<[string, string[], string]> => {

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: {
            height: 889,
            width: 1268
        },
        args: ['--disable-blink-features=AutomationControlled'],
        userDataDir: './chrome-profile'
    });

    const page = (await browser.pages()).at(0);

    if (page) {
        await page.goto('https://app.thestorygraph.com/', {waitUntil: 'networkidle0'});
        await page.type('input[name="search_term"]', title);
        await page.waitForNetworkIdle();
        await page.click('#search-all-books-dropdown > ul > li:first-child');
        await page.waitForNetworkIdle();
        const parsedTitle = await page.$eval('.book-title-author-and-series > h3', (titleEl) => titleEl.innerText);
        const tags = await page.$$eval('.book-page-tag-section > span', (tags) => {
            return tags.map(tag => tag.innerHTML);
        });

        await page.click('.read-more-btn');
        const description = await page.$eval('.trix-content > div', (titleEl) => titleEl.innerText);
        browser.close();
        return [parsedTitle, tags, description];
    }
    browser.close();
    return ['',[''], ''];
}

const fetchOpenAiReview = async (title: string, tags: string[], description: string, client: OpenAI) => {
    try {
        const response = await client.chat.completions.create({
            model: "local-model",
            messages: [
                {
                    role: 'user',
                    content: getReviewTemplate(title, tags, description)
                }
            ],
            temperature: 0.7,
        });
        return response.choices[0].message.content;
    } catch (err) {
        console.error(err);
        return "Error fetching review";
    }
}

const getReviewTemplate = (title: string, tags: string[], description: string) => {
    const randomPersonality = reviewerPersonalities[Math.floor(Math.random() * reviewerPersonalities.length)];
    return `You are a ${randomPersonality} book reviewer. Give me a short description for this book. Do not use any special markdown characters, just plain text.
    Title: ${title}
    Tags: ${tags}
    Description: ${description}`;
}