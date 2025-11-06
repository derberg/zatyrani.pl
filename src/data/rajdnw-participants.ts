import rajdnwData from "./rajdnw-participants.json";

export interface Participants {
  year: string;
  firstname: string;
  lastname: string;
  club: string;
  location: string;
}

export const participants: Participants[] = rajdnwData as Participants[];
