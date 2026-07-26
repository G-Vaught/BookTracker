import { DataSourceCode } from "../models/DataSourceCode";
import { prisma } from "./prisma";

const STORYGRAPH_SCRAPER = 'isStorygraphEnabled';
const GOODREADS_SCRAPER = 'isGoodreadsEnabled';
let OPEN_AI_URL = '"http://192.168.1.14:1234/v1';

export const toggleScraper = async (scraper: DataSourceCode) => {
    if (scraper === DataSourceCode.STORYGRAPH) {
        await prisma.config.update({
            where: {
                name: STORYGRAPH_SCRAPER
            },
            data: {
                value: await isScraperEnabled(DataSourceCode.STORYGRAPH) ? 'false': 'true'
            }
        });
    } else {
        await prisma.config.update({
            where: {
                name: GOODREADS_SCRAPER
            },
            data: {
                value: await isScraperEnabled(DataSourceCode.GOODREADS) ? 'false': 'true'
            }
        });
    }
}

const getScraperValue = async (scraper: DataSourceCode) => scraper === DataSourceCode.STORYGRAPH ? (await prisma.config.findFirstOrThrow({where: {name: STORYGRAPH_SCRAPER}})).value : (await prisma.config.findFirstOrThrow({where: {name: GOODREADS_SCRAPER}})).value;

export const isScraperEnabled = async (scraper: DataSourceCode) => {
    if (scraper === DataSourceCode.STORYGRAPH) {
        const config = await prisma.config.findFirst({where: {name: STORYGRAPH_SCRAPER}});
        if (config) {
            return config.value === "true"
        }
        return false
    } else {
        const config = await prisma.config.findFirst({where: {name: GOODREADS_SCRAPER}});
        if (config) {
            return config.value === "true"
        }
        return false;
    }
}

export const isCloudflareConfigEnabled = async () => {
	const captchaConfig = await prisma.config.findFirst({where: {name: 'isCloudflareCaptchaEnabled'}});
    if (captchaConfig) {
        return captchaConfig.value === 'true';
    }
    return false;
}

export const getOpenAiUrl = async () => {
    return await prisma.config.findFirst({where: {name: 'OpenAiUrl'}});
}

export const updateOpenAiUrl = async (url: string) => {
    await prisma.config.update({
        where: {
            name: 'OpenAiUrl'
        },
        data: {
            value: url
        }
    });
    console.log('Update OpenAiUrl to ', url);
}