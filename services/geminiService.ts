// newsProcessor.ts
import { GoogleGenAI, Type } from '@google/genai';
import { ProcessedNewsItem } from '../types';

export const processNews = async (articles: any[]): Promise<ProcessedNewsItem[]> => {
    // The Gemini API key is expected to be available as process.env.API_KEY in the execution environment.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const articlesForPrompt = articles.map((a: any) => ({
        title: a.title,
        description: a.description,
        image_url: a.image_url
    }));
    
    const prompt = `You are a savvy, trend-aware breaking news editor for "Paka Kotha News," a viral social media news channel targeting Gen Z and Millennial audiences in Bangladesh. Your task is to select the 5 most engaging, relevant, and shareable stories from the provided list of news articles.

Your selection process must strictly follow these rules in order of priority:

**Priority #1: ABSOLUTE EVENT & SUBJECT UNIQUENESS (MANDATORY)**
This is your most important rule. All 5 selected stories MUST be about completely different events.
- **No Duplicate Events:** Do not select two articles covering the same incident (e.g., the same political rally, the same product launch, the same natural disaster).
- **No Duplicate Subjects:** Do not select two different stories that are both about the same person, company, or organization, even if the events are different. The goal is a diverse list of subjects.
- **Critically Analyze:** Scrutinize headlines and descriptions. If two stories seem similar, err on the side of caution and pick only one. This rule overrides all other considerations. You must choose a less "perfect" but unique story over a better story that is a duplicate.

**Priority #2: VALID IMAGE REQUIREMENT (MANDATORY)**
You MUST ONLY select articles that have a valid, non-null 'image_url'. Any article provided to you without an 'image_url' must be completely ignored. This is a non-negotiable filter.

**Priority #3: TOPIC DIVERSITY (GUIDELINE)**
After satisfying the two mandatory rules above, try to create a diverse list of topics. If possible, select stories from different sectors like politics, technology, sports, business, innovation, culture, and international news. This is a preference, not a strict rule. Do not sacrifice uniqueness or the image requirement for the sake of diversity.

Formatting Instructions (for each of the 5 selected stories):
1.  **Headline:** Rewrite the headline in modern, natural-sounding, spoken Bangladeshi Bangla. Make it short, catchy, and shareable (under 12 words).
2.  **Description:** Write a concise summary (maximum 18 words) in modern, natural-sounding, spoken Bangladeshi Bangla. Keep the tone engaging and direct.
3.  **Image:** Preserve the original 'image_url'.

Here are the raw articles to choose from: ${JSON.stringify(articlesForPrompt)}

You MUST return exactly 5 stories that strictly meet all the mandatory criteria above. If fewer than 5 articles qualify, you must still return 5, choosing the next-best articles that fit the uniqueness and image rules. The final output must be a JSON object with a news_items array of exactly 5 items — not more, not less.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            news_items: {
                type: Type.ARRAY,
                description: "An array of 5 selected and formatted news stories for a Gen Z/Millennial audience.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        image_url: { type: Type.STRING, description: "The original image URL." },
                        headline: { type: Type.STRING, description: "Rewritten, catchy, spoken-style Bangla headline." },
                        description: { type: Type.STRING, description: "Engaging, spoken-style Bangla summary." },
                    },
                    required: ["image_url", "headline", "description"]
                }
            }
        },
        required: ["news_items"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema }
    });

    const parsedResponse = JSON.parse(response.text);
    let generatedNews: ProcessedNewsItem[] = parsedResponse.news_items;
    
    if (!generatedNews || !Array.isArray(generatedNews)) {
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
                // AI didn't format these, so use the original title/desc as a fallback.
                headline: fallbackArticle.title,
                description: fallbackArticle.description,
            }));
            
        const itemsNeeded = 5 - generatedNews.length;
        generatedNews.push(...fallbackCandidates.slice(0, itemsNeeded));
    }

    // Final slice to guarantee exactly 5 items, trimming any excess.
    return generatedNews.slice(0, 5);
};
