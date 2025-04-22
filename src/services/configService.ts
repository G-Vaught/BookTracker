import { DataSourceCode } from "../models/DataSourceCode";

let ENABLE_STORYGRAPH_SCRAPER = true;
let ENABLE_GOODREADS_SCRAPER = true;

export const toggleScraper = (scraper: DataSourceCode) => {
    if (scraper === DataSourceCode.STORYGRAPH) {
        ENABLE_STORYGRAPH_SCRAPER = !ENABLE_STORYGRAPH_SCRAPER;
    } else {
        ENABLE_GOODREADS_SCRAPER = !ENABLE_GOODREADS_SCRAPER;
    }
}

export const isScraperEnabled = (scraper: DataSourceCode) => scraper === DataSourceCode.STORYGRAPH ? ENABLE_STORYGRAPH_SCRAPER : ENABLE_GOODREADS_SCRAPER;