import membersData from "./members.json";

export interface Member {
  title: string;
  description: string;
  image: string;
  joinDate: string;
  from: string;
}

export const members: Member[] = membersData as Member[];
