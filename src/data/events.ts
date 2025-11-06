import eventsData from "./events.json";

export interface Events {
  title: string;
  description: string;
  image: string;
  date: string;
  location: string;
  mainLink: string;
  registrationLink: string;
}

export const events: Events[] = eventsData as Events[];
