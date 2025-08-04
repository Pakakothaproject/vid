import { GoogleGenAI, Type } from '@google/genai';
import { ProcessedNewsItem } from '../types';

export const processNews = async (articles: any[]): Promise<ProcessedNewsItem[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const articlesForPrompt = articles.map((a: any) => ({
        title: a.title,
        description: a.description,
        image_url: a.image_url
    }));

    const prompt = `You are a modern Bangladeshi news editor for a Gen Z audience at "Paka Kotha News". From the list of articles below, select exactly 5 engaging and diverse news stories. 

Rules (In order of priority):
- All 5 stories must be about completely different events — do not select duplicates or similar stories.
- Only use articles that have a non-null 'image_url'.
 -try to diverify news different topic or sector (e.g., politics, tech, sports, business, innovation, culture, international, etc.) but not at the cost of the other rules.

Format each story as:
- headline (in casual spoken Bangla, max 12 words)
- description (max 18 words, also in spoken Bangla)
- image_url (unchanged)

Always return exactly 5 diverse, unique stories in JSON format as: { news_items: [ ... ] }

Articles: ${JSON.stringify(articlesForPrompt)}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            news_items: {
                type: Type.ARRAY,
                description: "An array of 5 selected and formatted news stories for a Gen Z/Millennial audience.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        image_url: { type: Type.STRING },
                        headline: { type: Type.STRING },
                        description: { type: Type.STRING },
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

    let generatedNews: ProcessedNewsItem[] = [];

    try {
        const parsedResponse = JSON.parse(response.text);
        if (Array.isArray(parsedResponse.news_items)) {
            generatedNews = parsedResponse.news_items;
        }
    } catch (err) {
        console.warn("Failed to parse Gemini response. Falling back.");
    }

    const usedTitles = new Set<string>();
    const usedSectors = new Set<string>();

    function inferSector(text: string): string {
        const lowered = text.toLowerCase();
        if (lowered.includes('minister') || lowered.includes('election')) return 'politics';
        if (lowered.includes('tech') || lowered.includes('startup') || lowered.includes('app')) return 'tech';
        if (lowered.includes('bank') || lowered.includes('taka') || lowered.includes('stock')) return 'business';
        if (lowered.includes('attack') || lowered.includes('killed') || lowered.includes('arrest')) return 'violence';
        if (lowered.includes('award') || lowered.includes('achievement')) return 'inspiration';
        if (lowered.includes('world') || lowered.includes('international')) return 'international';
        return 'other';
    }

    const finalNews: ProcessedNewsItem[] = [];

    for (const item of generatedNews) {
        const sector = inferSector(item.headline + ' ' + item.description);
        if (!usedTitles.has(item.headline) && !usedSectors.has(sector)) {
            finalNews.push(item);
            usedTitles.add(item.headline);
            usedSectors.add(sector);
        }
        if (finalNews.length === 5) break;
    }

    if (finalNews.length < 5) {
        const fallbackCandidates = articlesForPrompt.filter(article =>
            article.image_url && !usedTitles.has(article.title)
        );

        for (const fallback of fallbackCandidates) {
            const sector = inferSector(fallback.title + ' ' + fallback.description);
            if (!usedSectors.has(sector)) {
                finalNews.push({
                    image_url: fallback.image_url,
                    headline: fallback.title,
                    description: fallback.description,
                });
                usedTitles.add(fallback.title);
                usedSectors.add(sector);
            }
            if (finalNews.length === 5) break;
        }
    }

    return finalNews.slice(0, 5);
};
