import newsData from "./news.json";

export interface NewsItem {
	date: string;
	message: string;
	id?: string;
	image?: string;
	postUrl?: string;
}

export const news: NewsItem[] = newsData as NewsItem[];
