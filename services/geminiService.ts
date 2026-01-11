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

// 修改 generateItinerarySuggestion
export const generateItinerarySuggestion = async (day: number, context: string, areas?: string): Promise<Omit<ItineraryItem, 'id'>[]> => {
  return retryOperation(async () => {
    try {
      const areaPrompt = areas ? `Specifically focusing on these areas: ${areas}. Optimize route.` : '';
      
      // 1. 修改 Prompt：移除了 lat, lng, weather 的要求
      // 我們只要求 time, activity, location, notes
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
                location: { type: Type.STRING }, // AI 只要給地點名就好
                notes: { type: Type.STRING },
                // 移除 lat, lng
                // 移除 weather
              },
              required: ["time", "activity", "location"]
            }
          }
        }
      });

      const items = JSON.parse(response.text || "[]");

      // 2. 後製處理 (Post-processing)
      // 拿到 AI 的清單後，我們自己去查座標，不用 AI 猜
      const enrichedItems = await Promise.all(items.map(async (item: any) => {
        // 呼叫免費的 OpenStreetMap 函式
        const coords = await getCoordinatesForLocation(item.location);
        
        return {
          ...item,
          day,
          // 如果查得到就用查的，查不到就給個預設值或 null，讓前端處理
          lat: coords ? coords.lat : 37.5665, 
          lng: coords ? coords.lng : 126.9780,
          // 天氣建議在前端顯示時再即時 fetch，這裡先不存，或者存 null
          weather: null 
        };
      }));

      return enrichedItems;

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
// src/services/geminiService.ts

// ... 其他 import 保持不變

/**
 * 修改後的版本：使用 OpenStreetMap (Nominatim) 免費搜尋經緯度
 * 不再消耗 Gemini AI 額度
 */
export const getCoordinatesForLocation = async (locationName: string): Promise<{ lat: number; lng: number } | null> => {
  if (!locationName) return null;

  try {
    // 使用 Nominatim API 進行搜尋
    // q: 搜尋關鍵字
    // format: 回傳 json 格式
    // limit: 只要 1 筆結果
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`
    );

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
    
    console.warn(`找不到地點: ${locationName}`);
    return null;

  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
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
