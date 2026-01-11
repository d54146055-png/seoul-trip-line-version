import { GoogleGenAI, Type } from "@google/genai";
import { ItineraryItem, ParsedLocation } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Gemini API Key is missing! Please check Vercel environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

// --- 新增：防當機小幫手 (延遲與重試機制) ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delayTime = 1000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // 如果遇到 429 (請求過多) 錯誤，就等待並重試
    if (retries > 0 && (error.toString().includes("429") || error.status === 429)) {
      console.warn(`⚠️ API 忙碌中 (429). ${delayTime}ms 後重試... (剩餘次數: ${retries})`);
      await delay(delayTime);
      return retryOperation(operation, retries - 1, delayTime * 2);
    }
    throw error;
  }
}

// --- 主要功能區 ---

export const generateItinerarySuggestion = async (day: number, context: string, areas?: string): Promise<Omit<ItineraryItem, 'id'>[]> => {
  return retryOperation(async () => {
    try {
      const areaPrompt = areas ? `Specifically focusing on these areas: ${areas}. Optimize route.` : '';
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Suggest a 1-day Seoul itinerary for Day ${day}. ${areaPrompt} Context: ${context}. Return JSON array.`,
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

      const items = JSON.parse(response.text || "[]");
      return items.map((item: any) => ({ ...item, day }));
    } catch (error) {
      console.error("Gemini Itinerary Error:", error);
      return [];
    }
  });
};

export const parseLocationsFromText = async (text: string): Promise<ParsedLocation[]> => {
  if (!text || text.length < 5) return [];
  return retryOperation(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Extract Seoul travel locations from: "${text.substring(0, 2000)}". Return JSON array.`,
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
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Parsing locations error:", error);
      return [];
    }
  });
};

// --- 修改重點：這裡原本是 AI 猜時間，現在改成了「Map Link」結構 ---
export interface RouteOption {
  type: 'map-link'; 
  summary: string; // 例如 "Naver Map"
  url: string;     // 點擊後開啟的網址
}

export const calculateRoute = async (from: string, to: string): Promise<RouteOption[]> => {
  // 不使用 AI，直接產生連結，省錢又快速
  const encodedTo = encodeURIComponent(to);
  const encodedFrom = encodeURIComponent(from);

  return [
    {
      type: 'map-link',
      summary: 'Open in Naver Map (推薦)',
      url: `https://map.naver.com/v5/search/${encodedTo}` 
    },
    {
      type: 'map-link',
      summary: 'Open in Google Maps',
      url: `https://www.google.com/maps/dir/?api=1&origin=${encodedFrom}&destination=${encodedTo}&travelmode=transit`
    }
  ];
};

export const parseActivityFromText = async (text: string): Promise<Partial<ItineraryItem>> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract itinerary activity from: "${text}". Return JSON.`,
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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { activity: "New Activity", time: "10:00" };
  }
}

export const chatWithTravelGuide = async (message: string, location?: { lat: number; lng: number }) => {
  try {
    const prompt = location 
      ? `(User at ${location.lat}, ${location.lng}) ${message}`
      : message;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are a helpful Seoul guide. Be concise.`,
        tools: [{ googleSearch: {} }],
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const mapChunks = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        source: {
          title: chunk.web.title || "Web Reference",
          uri: chunk.web.uri
        }
      }));

    return {
      text: response.text || "",
      mapChunks: mapChunks
    };
  } catch (error) {
    return { text: "Network busy, please try again.", mapChunks: [] };
  }
};

// --- 修改重點：查詢座標加入重試機制，並加上 null 保護 ---
export const getCoordinatesForLocation = async (location: string): Promise<{lat: number, lng: number} | null> => {
  return retryOperation(async () => {
    try {
      // 常用地點寫死 (省錢技巧)
      if (location.includes("Incheon Airport")) return { lat: 37.4602, lng: 126.4407 };
      if (location.includes("Seoul Station")) return { lat: 37.5547, lng: 126.9707 };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Return strictly JSON {lat, lng} for: "${location}" in Seoul. If generic, return null.`,
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
      
      if (!response.text) return null;
      return JSON.parse(response.text);
    } catch (error) {
      console.error("Geocoding Error:", error);
      return null;
    }
  }, 2, 2000); // 最多重試 2 次，間隔 2 秒
};

export const generateNextActivitySuggestion = async (currentItems: ItineraryItem[]): Promise<Partial<ItineraryItem> | null> => {
    try {
        const context = currentItems.map(i => `${i.time}: ${i.activity}`).join('\n');
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Given itinerary:\n${context}\n\nSuggest ONE next activity nearby. Return JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        time: { type: Type.STRING },
                        activity: { type: Type.STRING },
                        location: { type: Type.STRING },
                        lat: { type: Type.NUMBER },
                        lng: { type: Type.NUMBER },
                         weather: { // 保持一致性
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
        return JSON.parse(response.text || "null");
    } catch (e) {
        return null;
    }
};
