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
    
    const prompt = `You are a savvy, trend-aware breaking news editor for "Paka Kotha News," a viral social media news channel targeting Gen Z and Millennial audiences in Bangladesh. Your task is to select the 5 most engaging, relevant, and shareable stories from the following list of news articles. The goal is to create a news roundup that feels fresh, modern, and important to a young audience. Also ensure these are the most important news items of the day—prioritize breaking or high-impact stories over pure entertainment.

Selection Criteria:
1.  **Audience Appeal:** Choose stories that would genuinely interest a young Bangladeshi. Think tech, innovation, culture, significant national events, and inspiring personal achievements.
2.  **Importance:** Prioritize “news of the day”—major developments or breaking updates. Avoid mostly entertainment or low-impact pieces unless you can’t fill the list with high-impact stories.
3.  **Topic Diversity & Limits:**
    - Include **at most one political** news story.
    - If there are any notable **violence-related** stories, include **up to one** of them.
    - Your final selection of 5 stories MUST also include at least 2–3 from these categories:
      * Business or Technology Innovation  
      * Major International News impacting Bangladesh  
      * Inspiring Bangladeshis achieving something notable  
4.  **Content Quality:** Prioritize articles with clear descriptions and high-quality images. Avoid generic political updates unless it's a major, paradigm-shifting event.

Formatting Instructions (for each of the 5 selected stories):
1.  **Headline:** Rewrite the headline in modern, natural-sounding, spoken Bangladeshi Bangla. Make it short, catchy, and shareable (under 12 words).
2.  **Description:** Write a concise summary (2–3 sentences) in modern, natural-sounding, spoken Bangladeshi Bangla. Keep the tone engaging and direct.
3.  **Image:** Preserve the original 'image_url'.

Here are the raw articles to choose from: ${JSON.stringify(articlesForPrompt)}

Provide your output as a JSON object containing a 'news_items' array with exactly 5 objects, following the specified format.`;

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
    const generatedNews = parsedResponse.news_items;
    
    if (!generatedNews || !Array.isArray(generatedNews) || generatedNews.length === 0) {
        throw new Error("AI failed to generate news in the expected format.");
    }

    return generatedNews.slice(0, 5);
};
