export interface NewsItem {
  id: string;
  headline: string;
  description: string;
  image: string;
  audioSrc: string | null;
}

export interface ProcessedNewsItem {
  image_url: string;
  headline: string;
  description: string;
}
