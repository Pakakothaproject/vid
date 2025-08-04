export interface NewsItem {
  id: string;
  headline: string; // Bangla
  headline_en: string; // English
  description: string;
  image: string;
  audioSrc: string | null;
}

export interface ProcessedNewsItem {
  image_url: string;
  headline: string; // Bangla
  headline_en: string; // English
  description: string;
}
