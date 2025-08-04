// newsProcessor.ts
import { GoogleGenAI, Type } from '@google/genai';
import { ProcessedNewsItem } from '../types';

interface NewsGenerationResponse {
  news_items: ProcessedNewsItem[];
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
    
    const prompt = `You are a meticulous and discerning breaking news editor for "Paka Kotha News," a viral social media news channel in Bangladesh. Your primary task is to curate a list of exactly 5 unique, engaging, and visually-backed news stories from a provided list.

Your selection and formatting process must follow these steps precisely:

**Step 1: Initial Selection**
- Scan the list of raw articles.
- Select more than 5 candidate stories that seem promising based on being engaging and relevant to a Bangladeshi audience.
- **MANDATORY:** Every candidate you select MUST have a valid, non-null 'image_url'.

**Step 2: Uniqueness Verification (CRITICAL)**
- Review your candidate stories.
- You MUST eliminate any stories that are thematically or factually related. This is the most important rule.
- **Definition of "Related":** Stories about the same event (e.g., different updates on a single political situation), the same person (e.g., a celebrity's recent activities), the same specific incident (e.g., a crime and the subsequent investigation), or very similar topics (e.g., two different stories about heatwaves).
- Your final list of 5 MUST be about completely distinct and separate subjects. If you find duplicates, discard them and select new, unique articles from the raw list that also have an 'image_url'.

**Step 3: Final Curation**
- From your verified unique list, select the final 5 most compelling stories.
- Aim for topic diversity (e.g., mix politics, technology, culture, sports if possible).

**Step 4: Formatting and Hashtag Generation**
For each of the 5 final stories, format them as follows:
1.  **headline:** Rewrite the headline in modern, natural-sounding, spoken Bangladeshi Bangla. Make it short, catchy, and shareable (under 12 words).
2.  **headline_en:** Provide a short, catchy, English version of the headline suitable for social media.
3.  **description:** Write a concise summary (maximum 18 words) in modern, natural-sounding, spoken Bangladeshi Bangla.
4.  **image_url:** Preserve the original 'image_url'.

After formatting the 5 stories, generate hashtags:
- **hashtags_en**: Create a single string of relevant, trending English hashtags.
- **hashtags_bn**: Create a single string of relevant, trending Bengali hashtags.

Here are the raw articles to choose from: ${JSON.stringify(articlesForPrompt)}

You MUST return a single JSON object. The object must contain a 'news_items' array of exactly 5 stories that have passed the uniqueness verification, a 'hashtags_en' string, and a 'hashtags_bn' string.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            news_items: {
                type: Type.ARRAY,
                description: "An array of 5 selected and formatted news stories.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        image_url: { type: Type.STRING, description: "The original image URL." },
                        headline: { type: Type.STRING, description: "Rewritten, catchy, spoken-style Bangla headline." },
                        headline_en: { type: Type.STRING, description: "A short, catchy, English version of the headline." },
                        description: { type: Type.STRING, description: "Engaging, spoken-style Bangla summary." },
                    },
                    required: ["image_url", "headline", "headline_en", "description"]
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

    let generatedNews: ProcessedNewsItem[] = parsedResponse.news_items || [];
    
    if (!Array.isArray(generatedNews)) {
        console.warn("AI returned a non-array or missing 'news_items'. Attempting to build a list from scratch.");
        generatedNews = [];
    }

    // Fallback logic to ensure we always have exactly 5 news items.
    if (generatedNews.length < 5) {
        const existingImageUrls = new Set(generatedNews.map(item => item.image_url));
        
        const fallbackCandidates = articlesForPrompt
            .filter(originalArticle => originalArticle.image_url && !existingImageUrls.has(originalArticle.image_url))
            .map(fallbackArticle => ({
                image_url: fallbackArticle.image_url,
                headline: fallbackArticle.title, // Fallback to original title
                headline_en: fallbackArticle.title, // Fallback to original title
                description: fallbackArticle.description,
            }));
            
        const itemsNeeded = 5 - generatedNews.length;
        generatedNews.push(...fallbackCandidates.slice(0, itemsNeeded));
    }

    // Final slice to guarantee exactly 5 items, trimming any excess.
    return {
        news_items: generatedNews.slice(0, 5),
        hashtags_en: parsedResponse.hashtags_en || '#news #bangladesh #breakingnews',
        hashtags_bn: parsedResponse.hashtags_bn || '#খবর #বাংলাদেশ #শিরোনাম',
    };
};
