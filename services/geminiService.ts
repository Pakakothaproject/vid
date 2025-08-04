// newsProcessor.ts
import { GoogleGenAI, Type } from '@google/genai';
import { ProcessedNewsItem } from '../types';

// The AI now returns categorized items, which are processed locally.
interface CategorizedNewsItem extends ProcessedNewsItem {
  category: string;
}

interface NewsGenerationResponse {
  news_items: CategorizedNewsItem[];
  hashtags_en: string;
  hashtags_bn: string;
}

export const processNews = async (articles: any[]): Promise<NewsGenerationResponse> => {
    // The Gemini API key is expected to be available as process.env.API_KEY in the execution environment.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const articlesForPrompt = articles.map((a: any) => ({
        title: a.title,
        description: a.description,
        image_url: a.image_url
    }));
    
    const prompt = `You are a meticulous and discerning breaking news editor for "Paka Kotha News," a viral social media news channel in Bangladesh. Your primary task is to curate a list of 8-10 unique, engaging, and visually-backed news stories from a provided list.

Your selection and formatting process must follow these steps precisely:

**Step 1: Initial Selection & Uniqueness Verification (CRITICAL)**
- Scan the list of raw articles and select 8-10 candidate stories.
- **MANDATORY:** Every candidate you select MUST have a valid, non-null 'image_url'.
- **CRITICAL RULE:** You MUST eliminate any stories that are thematically or factually related. The final list of candidates must be about completely distinct and separate subjects.
- **Definition of "Related":** Stories about the same event (e.g., different updates on a single political situation), the same person (e.g., a celebrity's recent activities), the same specific incident (e.g., a crime and the subsequent investigation), or very similar topics (e.g., two different stories about heatwaves).

**Step 2: Formatting and Categorization**
For each of the 8-10 final candidate stories, format them as follows:
1.  **headline:** Rewrite the headline in modern, natural-sounding, spoken Bangladeshi Bangla. Make it short, catchy, and shareable (under 12 words).
2.  **headline_en:** Provide a short, catchy, English version of the headline suitable for social media.
3.  **description:** Write a concise summary (maximum 18 words) in modern, natural-sounding, spoken Bangladeshi Bangla.
4.  **image_url:** Preserve the original 'image_url'.
5.  **category:** Assign a single, relevant category from this list: ['Politics', 'Business', 'Technology', 'Sports', 'Entertainment', 'Social', 'International', 'Crime', 'Weather'].

**Step 3: Hashtag Generation**
After formatting the stories, generate hashtags:
- **hashtags_en**: Create a single string of relevant, trending English hashtags.
- **hashtags_bn**: Create a single string of relevant, trending Bengali hashtags.

Here are the raw articles to choose from: ${JSON.stringify(articlesForPrompt)}

You MUST return a single JSON object. The object must contain a 'news_items' array of 8 to 10 stories, a 'hashtags_en' string, and a 'hashtags_bn' string.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            news_items: {
                type: Type.ARRAY,
                description: "An array of 8-10 selected, formatted, and categorized news stories.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        image_url: { type: Type.STRING, description: "The original image URL." },
                        headline: { type: Type.STRING, description: "Rewritten, catchy, spoken-style Bangla headline." },
                        headline_en: { type: Type.STRING, description: "A short, catchy, English version of the headline." },
                        description: { type: Type.STRING, description: "Engaging, spoken-style Bangla summary." },
                        category: { type: Type.STRING, description: "The assigned category for the story from the provided list." }
                    },
                    required: ["image_url", "headline", "headline_en", "description", "category"]
                }
            },
            hashtags_en: {
                type: Type.STRING,
                description: "A single string of relevant English hashtags, space-separated, starting with #."
            },
            hashtags_bn: {
                type: Type.STRING,
                description: "A single string of relevant Bengali hashtags, space-separated, starting with #."
            }
        },
        required: ["news_items", "hashtags_en", "hashtags_bn"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema }
    });

    let parsedResponse: Partial<NewsGenerationResponse>;
    try {
        parsedResponse = JSON.parse(response.text);
    } catch (e) {
        console.error("Failed to parse AI response as JSON.", e);
        parsedResponse = {};
    }

    const candidates = parsedResponse.news_items || [];
    const finalNews: CategorizedNewsItem[] = [];
    const usedCategories = new Set<string>();
    const usedImageUrls = new Set<string>();

    // Stage 2, Pass 1: Curate by prioritizing unique categories for diversity.
    for (const item of candidates) {
        if (finalNews.length >= 5) break;

        const isDuplicateImage = usedImageUrls.has(item.image_url);
        const isDuplicateCategory = usedCategories.has(item.category);

        if (!isDuplicateImage && !isDuplicateCategory) {
            finalNews.push(item);
            usedCategories.add(item.category);
            usedImageUrls.add(item.image_url);
        }
    }

    // Stage 2, Pass 2: If we still need more stories, fill with any remaining unique items.
    if (finalNews.length < 5) {
        for (const item of candidates) {
            if (finalNews.length >= 5) break;
            if (!usedImageUrls.has(item.image_url)) {
                finalNews.push(item);
                usedImageUrls.add(item.image_url);
            }
        }
    }
    
    // Fallback logic to ensure we always have exactly 5 news items.
    if (finalNews.length < 5) {
        const fallbackCandidates = articlesForPrompt
            .filter(originalArticle => originalArticle.image_url && !usedImageUrls.has(originalArticle.image_url))
            .map(fallbackArticle => ({
                image_url: fallbackArticle.image_url,
                headline: fallbackArticle.title, // Fallback to original title
                headline_en: fallbackArticle.title, // Fallback to original title
                description: fallbackArticle.description,
                category: 'Social', // Add default category for type consistency
            }));
            
        const itemsNeeded = 5 - finalNews.length;
        finalNews.push(...fallbackCandidates.slice(0, itemsNeeded));
    }

    // Final slice to guarantee exactly 5 items, trimming any excess.
    return {
        news_items: finalNews.slice(0, 5),
        hashtags_en: parsedResponse.hashtags_en || '#news #bangladesh #breakingnews',
        hashtags_bn: parsedResponse.hashtags_bn || '#খবর #বাংলাদেশ #শিরোনাম',
    };
};
