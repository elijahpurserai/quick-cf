export type Visibility = "public" | "unlisted" | "private";

export interface Story {
  id: string;
  title: string;
  content: string;
  childName: string;
  gender: "male" | "female" | "unspecified";
  age: number;
  purpose: "adventure" | "education" | "custom";
  educationCategory?: string;
  additionalInfo?: string;
  siblings?: { name: string; gender: "male" | "female" | "unspecified" }[];
  pets?: { name: string; type: string }[];
  parentNames?: { name: string; gender: "male" | "female" | "unspecified" }[];
  duration: number; // in minutes
  createdAt: Date;
  rating: number;
  ratingsCount: number;
  chapters: StoryChapter[];
  tags: (string | Tag)[];
  description: string;
  ownerId?: string;
  visibility?: Visibility;
  language?: string;
  imageUrl?: string;
  slug?: string;
  englishTitle?: string;
  imagePrompt?: string;
}

export interface Tag {
  name: string;
  slug: string;
}
export interface Lesson {
  id: string;
  topic: string;
  level: string;
  tone: string;
  content: string;
  duration: number; // in minutes
  createdAt: Date;
  rating: number;
  ratingsCount: number;
  tags: (string | Tag)[];
  ownerId?: string;
  visibility?: Visibility;
  language?: string;
  imageUrl?: string;
  slug?: string;
  englishTitle?: string;
  description?: string;
  imagePrompt?: string;
}

export interface StoryChapter {
  id: string;
  content: string;
  createdAt: Date;
}

export interface StoryFormData {
  purpose: "adventure" | "education" | "custom";
  childName: string;
  gender: "male" | "female" | "unspecified";
  age: number;
  educationGoal?: string;
  educationCategory?: string;
  additionalInfo?: string;
  siblingNames: { name: string; gender: "male" | "female" | "unspecified" }[];
  pets: { name: string; type: string }[];
  parentNames: { name: string; gender: "male" | "female" | "unspecified" }[];
  duration: number;
  language: string;
  visibility?: Visibility;
}

export interface LessonFormData {
  topic: string;
  level: string;
  tone: string;
  additionalInfo?: string;
  duration: number;
  language: string;
  visibility?: Visibility;
}

export interface HeroProfile {
  id: string;                   // client-generated UUID, stable across saves
  childName: string;
  gender: "male" | "female" | "unspecified";
  age: number | null;
  siblingNames: { name: string; gender: "male" | "female" | "unspecified" }[];
  pets: { name: string; type: string }[];
  parentNames: { name: string; gender: "male" | "female" | "unspecified" }[];
  language: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isAdmin?: boolean;
}

export const EDUCATION_CATEGORIES = [
  "Emotional Intelligence",
  "Sharing",
  "Confidence",
  "Dealing with Fear",
  "Potty Training",
  "First Day of School",
  "Bullying",
  "Losing a Tooth",
  "Bedtime Anxiety",
  "Healthy Eating",
  "Other",
];

export const DURATION_OPTIONS = [
  { label: "7 minutes", value: 7 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "Custom", value: 0 },
];

export const LESSON_LEVELS = [
  "Preschool (3-5)",
  "Elementary (6-10)",
  "Middle School (11-13)",
  "High School (14+)",
  "Adult",
];

export const LESSON_TONES = [
  "Fun & Engaging",
  "Serious & Academic",
  "Simple & Clear",
  "Storytelling",
];
