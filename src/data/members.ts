import membersData from "./members.json";

export interface Member {
  id: string;
  title: string;
  from: string;
  image: string;
  joinDate: string;
}

export const members: Member[] = membersData as Member[];
