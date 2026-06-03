import axios from 'axios';
import * as cheerio from 'cheerio';
import { INews } from '../models/StockCache';

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

export const scrapeYahooFinance = async (ticker: string) => {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const newsUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5`; 

    const [chartRes, newsRes] = await Promise.all([
        axios.get(chartUrl, { headers: HEADERS }),
        axios.get(newsUrl, { headers: HEADERS })
    ]);

    if (!chartRes.data.chart || !chartRes.data.chart.result || chartRes.data.chart.result.length === 0) {
        throw new Error(`Ticker "${ticker}" not found or delisted.`);
    }

    const meta = chartRes.data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const changeAmount = (price - prevClose);
    const changePercent = ((changeAmount / prevClose) * 100).toFixed(2) + "%";

    const rawNews = newsRes.data.news || [];
    const news: INews[] = rawNews.map((article: any) => ({
        title: article.title, link: article.link, publisher: article.publisher
    }));

    return { 
        price: price.toFixed(2).toString(), 
        change: changeAmount.toFixed(2).toString(), 
        changePercent: changePercent,
        news 
    };
};

export const scrapeArticleHTML = async (url: string): Promise<string[]> => {
    const { data } = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(data);
    const paragraphs: string[] = [];

    $('.caas-body p, .article-body p, article p, .entry-content p').each((i, element) => {
        const text = $(element).text().trim();
        if (text && text.length > 20) paragraphs.push(text);
    });

    if (paragraphs.length === 0) throw new Error("Could not extract text.");
    return paragraphs;
};