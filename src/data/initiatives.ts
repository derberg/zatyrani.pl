import initiativesData from "./initiatives.json";

export interface Initiative {
	title: string;
	description: string;
	schedule: string;
	image: string;
	link: string;
	imageClass?: string;
}

export const initiatives: Initiative[] = initiativesData as Initiative[];