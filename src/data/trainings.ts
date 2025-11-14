import trainingsData from "./trainings.json";

export interface Training {
  uid: string;
  type: "bieg" | "nordic walking";
  datetime: string;
  location: string;
  locationLink: string;
  comment?: string;
  phone: string;
  distance: number;
  pace: number;
}

export const trainings: Training[] = trainingsData as Training[];
