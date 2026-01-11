import { GoogleGenAI, Type } from "@google/genai";
import { ItineraryItem, ParsedLocation } from "../types";

// 1. 環境變數檢查
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Gemini API Key is missing! Please check Vercel environment variables.");
}

// 2. 初始化 SDK
const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

// 3. 統一模型版本
const MODEL_NAME = "gemini-2.5-flash"; 

// --- 核心功能函式 ---

export const generateItinerarySuggestion = async (day: number, context: string, areas?: string): Promise<Omit<ItineraryItem, 'id'>[]> => {
  try {
    const areaPrompt = areas ? `Specifically focusing on these areas/districts: ${areas}. Arrange the route logically.` : '';
    
    // 直接定義物件，不使用額外的 Type 宣告以避免匯入錯誤
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Suggest a realistic 1-day itinerary for Day ${day} of a trip to Seoul, South Korea. 
      ${areaPrompt}
      Context/Vibe: ${context}.
      Include estimated weather.
      IMPORTANT: Provide accurate latitude (lat) and longitude (lng) for each location.
      Return a JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING },
              activity: { type: Type.STRING },
              location: { type: Type.STRING },
              notes: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              weather: {
                type: Type.OBJECT,
                properties: {
                  temp: { type: Type.NUMBER },
                  condition: { type: Type.STRING },
                  icon: { type: Type.STRING }
                }
              }
            },
            required: ["time", "activity", "location"]
          }
        }
      }
    });

    const text = response.text();
    const items = text ? JSON.parse(text) : [];
    
    return items.map((item: any) => ({
      ...item,
      day
    }));
  } catch (error) {
    console.error("Gemini Itinerary Error:", error);
    return [];
  }
};

export const parseLocationsFromText = async (text: string): Promise<ParsedLocation[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME, 
      contents: `Extract all travel locations/places in Seoul mentioned in this text. 
      For each location, provide coordinates. Return JSON array. 
      Text: "${text.substring(0, 5000)}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              description: { type: Type.STRING }
            },
            required: ["name", "lat", "lng"]
          }
        }
      }
    });
    
    const resText = response.text();
    return resText ? JSON.parse(resText) : [];
  } catch (error) {
    console.error("Parsing locations error:", error);
    return [];
  }
};

export interface RouteOption {
  type: 'subway' | 'bus' | 'walk';
  duration: string;
  summary: string;
}

export const calculateRoute = async (from: string, to: string): Promise<RouteOption[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Estimate travel time/routes from "${from}" to "${to}" in Seoul. 
      Provide 3 options: Subway, Bus, Walking. Return JSON array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              duration: { type: Type.STRING },
              summary: { type: Type.STRING }
            },
            required: ["type", "duration", "summary"]
          }
        }
      }
    });
    const resText = response.text();
    return resText ? JSON.parse(resText) : [];
  } catch (e) {
    console.error("Route calculation error:", e);
    return [];
  }
};

export const parseActivityFromText = async (text: string): Promise<Partial<ItineraryItem>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Extract a single travel activity from: "${text}". Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING },
            activity: { type: Type.STRING },
            location: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: ["activity", "location", "time"]
        }
      }
    });
    const resText = response.text();
    return resText ? JSON.parse(resText) : {};
  } catch (e) {
    return { activity: "New Activity", time: "10:00" };
  }
}

// --- 對話與記憶相關 ---

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export const chatWithTravelGuide = async (
  message: string, 
  history: ChatMessage[] = [], 
  location?: { lat: number; lng: number }
) => {
  try {
    const prompt = location 
      ? `(User is currently at ${location.lat}, ${location.lng}) ${message}`
      : message;

    const chatSession = ai.models.startChat({
      model: MODEL_NAME,
      config: {
        systemInstruction: `You are a helpful Seoul travel guide. Concise. Naver Maps friendly.`,
        tools: [{ googleSearch: {} }], 
      },
      history: history 
    });

    const result = await chatSession.sendMessage(prompt);
    const response = result.response;

    const groundingChunks = response.groundingMetadata?.groundingChunks || [];
    const mapChunks = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        source: {
          title: chunk.web.title || "Web Reference",
          uri: chunk.web.uri
        }
      }));

    return {
      text: response.text() || "",
      mapChunks: mapChunks,
      newHistory: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] },
        { role: 'model', parts: [{ text: response.text() }] }
      ]
    };

  } catch (error) {
    console.error("Chat Error:", error);
    return {
      text: "Connection error. Please try again.",
      mapChunks: [],
      newHistory: history
    };
  }
};

export const getCoordinatesForLocation = async (location: string): Promise<{lat: number, lng: number} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Get lat/lng for "${location}" in Seoul. Return JSON {lat, lng}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
          },
          required: ["lat", "lng"]
        }
      }
    });
    const resText = response.text();
    if (!resText) return null;
    return JSON.parse(resText);
  } catch (error) {
    return null;
  }
};

export const generateNextActivitySuggestion = async (currentItems: ItineraryItem[]): Promise<Partial<ItineraryItem> | null> => {
  try {
    const context = currentItems.map(i => `${i.time}: ${i.activity} at ${i.location}`).join('\n');
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Given itinerary:\n${context}\n\nSuggest ONE next activity nearby. Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING },
            activity: { type: Type.STRING },
            location: { type: Type.STRING },
            notes: { type: Type.STRING },
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            weather: {
                type: Type.OBJECT,
                properties: {
                  temp: { type: Type.NUMBER },
                  condition: { type: Type.STRING },
                  icon: { type: Type.STRING }
                }
              }
          },
          required: ["activity", "location", "time"]
        }
      }
    });
    const resText = response.text();
    return resText ? JSON.parse(resText) : null;
  } catch (error) {
    return null;
  }
};
