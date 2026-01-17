import initiativesData from "./initiatives.json";

export interface Initiative {
  id: string;
  image: string;
  link?: string;
  imageClass?: string;
  hidden?: boolean;
}

export const initiatives: Initiative[] = initiativesData as Initiative[];
