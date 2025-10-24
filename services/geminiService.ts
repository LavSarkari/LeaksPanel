// You need to install this package: `npm install @google/genai`
import { GoogleGenAI, Type } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    // A bit of a hack for browser environment where process.env is not available by default.
    // In a real build setup (like Vite), you would use import.meta.env.VITE_API_KEY
    console.warn("API_KEY is not set. AI features will not work. Please set it in your environment.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

type AIAction = 'rephrase' | 'summarize' | 'expand' | 'tone-match';

const prompts: Record<AIAction, (text: string) => string> = {
  rephrase: (text) => `Rephrase the following text to be more clear and engaging:\n\n"${text}"`,
  summarize: (text) => `Summarize the following text into a concise paragraph:\n\n"${text}"`,
  expand: (text) => `Expand on the following point, adding more detail and explanation:\n\n"${text}"`,
  'tone-match': (text) => `Rewrite the following text to match a thoughtful, slightly technical, and personal blog post tone (like the "LavLeaks" vibe). Make it sound authentic and insightful:\n\n"${text}"`,
};

export async function performAiAction(action: AIAction, text: string): Promise<string> {
    if (!API_KEY) {
        throw new Error("Gemini API key is not configured.");
    }
  
  const model = 'gemini-2.5-flash';
  const prompt = prompts[action](text);
  
  try {
    const response = await ai.models.generateContent({
        model,
        contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Error with Gemini API:", error);
    throw new Error("Failed to generate AI content.");
  }
}

export async function generateFrontMatter(content: string): Promise<{ title: string; description: string; tags: string[] }> {
    if (!API_KEY) {
        throw new Error("Gemini API key is not configured.");
    }
    const model = 'gemini-2.5-flash';
    const prompt = `Analyze the following blog post content and generate a suitable title, a concise SEO-friendly description (under 160 characters), and an array of 3-5 relevant tags. Respond in JSON format.\n\nContent:\n${content}`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        tags: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                        },
                    },
                },
            },
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error with Gemini API (generateFrontMatter):", error);
        throw new Error("Failed to generate AI front matter.");
    }
}

export async function generateImageAltText(imageBase64: string, mimeType: string): Promise<string> {
    if (!API_KEY) {
        throw new Error("Gemini API key is not configured.");
    }
    const model = 'gemini-2.5-flash';
    const prompt = 'Describe this image for use as alt-text on a blog. Be concise and descriptive.';
    
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    };

    try {
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [imagePart, { text: prompt }] }
        });
        return response.text;
    } catch (error) {
        console.error("Error with Gemini API (generateImageAltText):", error);
        throw new Error("Failed to generate AI alt text.");
    }
}
