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
    
    const prompt = `You are a savvy, trend-aware breaking news editor for "Paka Kotha News," a viral social media news channel targeting Gen Z and Millennial audiences in Bangladesh. Your task is to select the 5 most engaging, relevant, and shareable stories from the following list of news articles. The goal is to create a news roundup that feels fresh, modern, and important to a young audience.

**CRITICAL RULE: EVENT UNIQUENESS IS THE #1 PRIORITY.**
You *must* ensure that all 5 selected stories are about completely distinct events. Critically evaluate the articles to avoid selecting two or more stories that report on the same core event, even if they are from different sources or are worded differently. For example, do not select two separate articles about the same political rally. This uniqueness rule trumps all other requirements. If you must choose between a "perfect" story that is a duplicate and a "less perfect" but unique story, you MUST choose the unique one.

Selection Criteria:
1.  **Image Requirement:** You MUST ONLY select articles that have a valid, non-null 'image_url'. Any article provided to you without an 'image_url' must be completely ignored. This is a mandatory filter.
2.  **Audience Appeal:** Choose stories that would genuinely interest a young Bangladeshi. Think tech, innovation, culture, significant national events, and inspiring personal achievements.
3.  **Importance:** Prioritize “news of the day”—major developments or breaking updates. Avoid mostly entertainment or low-impact pieces unless you can’t fill the list with high-impact stories.
4.  **Topic Diversity & Limits:**
    - Include **at most one political** news story.
    - If there are any notable **violence-related** stories, include **up to one** of them.
    - Your final selection of 5 stories MUST also include at least 2–3 from these categories:
      * Business or Technology Innovation  
      * Major International News impacting Bangladesh  
      * Inspiring Bangladeshis achieving something notable  

Formatting Instructions (for each of the 5 selected stories):
1.  **Headline:** Rewrite the headline in modern, natural-sounding, spoken Bangladeshi Bangla. Make it short, catchy, and shareable (under 12 words).
2.  **Description:** Write a concise summary (maximum 18 words) in modern, natural-sounding, spoken Bangladeshi Bangla. Keep the tone engaging and direct.
3.  **Image:** Preserve the original 'image_url'.

Here are the raw articles to choose from: ${JSON.stringify(articlesForPrompt)}

You MUST return exactly 5 stories that strictly meet all criteria above. If fewer than 5 qualify, you must still return 5, choosing the next-best articles that fit the image and uniqueness rules. If any articles are borderline, clearly prioritize unique topics and stories with valid images. Output must be a JSON object with a news_items array of exactly 5 items — not more, not less.`;

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
