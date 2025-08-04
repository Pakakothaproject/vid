// newsProcessor.ts
import { GoogleGenAI, Type } from '@google/genai';
import { ProcessedNewsItem } from '../types';

// The AI now returns categorized items.
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
    
    const prompt = `You are a meticulous breaking news editor for "Paka Kotha News," a viral social media news channel in Bangladesh. Your task is to curate exactly 5 unique, engaging, and visually-backed news stories from a provided list.

**CRITICAL RULES:**
1.  You MUST select exactly 5 stories relating to Banagldesh or its people.
2.  Every story MUST have a valid 'image_url'.
3.  The 5 stories MUST be about completely distinct and separate subjects. Do NOT include multiple stories about the same event, person, or incident (e.g., two stories about heatwaves).
4.  There must be atleast one news for each of these: Politics, Innovation or Business and Crime.
5.  All generated text ('headline', 'description') MUST be in modern, natural-sounding, spoken Bangladeshi Bangla.
5. If there’s a major update from the High Court or Supreme Court, give it slight priority — but **only one such story per cycle

**Formatting Instructions:**
For each of the 5 stories, format them as follows:
1.  **headline:** A short, catchy, spoken-style Bangla headline (under 12 words).
2.  **headline_en:** A short, catchy, English version of the headline.
3.  **description:** A concise summary (maximum 18 words) in spoken-style Bangla.
4.  **image_url:** Preserve the original 'image_url'.
5.  **category:** Assign a single, relevant category from this list: ['Politics', 'Business', 'Technology', 'Sports', 'Entertainment', 'Social', 'International', 'Crime', 'Weather'].

**Hashtag Generation:**
After formatting the 5 stories, generate two strings of hashtags:
- **hashtags_en**: A single string of relevant English hashtags.
- **hashtags_bn**: A single string of relevant Bengali hashtags.

Here are the raw articles: ${JSON.stringify(articlesForPrompt)}

You MUST return a single JSON object containing a 'news_items' array of exactly 5 stories, and the two hashtag strings.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            news_items: {
                type: Type.ARRAY,
                description: "An array of exactly 5 selected, formatted, and categorized news stories.",
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
        throw new Error("AI response was not valid JSON. See console for details.");
    }
    
    const finalNews = parsedResponse.news_items;

    // Strict validation of the AI's output
    if (!finalNews || !Array.isArray(finalNews) || finalNews.length !== 5) {
        console.error("AI did not return exactly 5 news items. Response:", JSON.stringify(parsedResponse, null, 2));
        throw new Error(`AI curation failed: Expected 5 news items, but received ${finalNews?.length || 0}.`);
    }

    // Further validation to ensure all items are complete
    for (let i = 0; i < finalNews.length; i++) {
        const item = finalNews[i];
        if (!item.image_url || !item.headline || !item.headline_en || !item.description || !item.category) {
            console.error(`AI returned an incomplete news item at index ${i}. Item:`, JSON.stringify(item, null, 2));
            throw new Error(`AI returned an incomplete news item at index ${i}.`);
        }
    }

    // If validation passes, return the data.
    return {
        news_items: finalNews,
        hashtags_en: parsedResponse.hashtags_en || '#news #bangladesh #breakingnews',
        hashtags_bn: parsedResponse.hashtags_bn || '#খবর #বাংলাদেশ #শিরোনাম',
    };
};
