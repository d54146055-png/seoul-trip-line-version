import { GoogleGenAI, Type, GenerationConfig } from "@google/genai";
import { ItineraryItem, ParsedLocation } from "../types";

// 1. 環境變數檢查
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Gemini API Key is missing! Please check Vercel environment variables.");
}

// 2. 初始化 SDK
const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

// 3. 統一模型版本
const MODEL_NAME = "gemini-2.0-flash-exp"; 

// --- 核心功能函式 ---

/**
 * 產生每日行程建議
 */
export const generateItinerarySuggestion = async (day: number, context: string, areas?: string): Promise<Omit<ItineraryItem, 'id'>[]> => {
  try {
    const areaPrompt = areas ? `Specifically focusing on these areas/districts: ${areas}. Arrange the route logically to minimize travel time between these districts.` : '';
    
    // 修正點：將 SchemaType 改為 Type
    const schema: GenerationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING, description: "Time in HH:MM format (24h)" },
            activity: { type: Type.STRING, description: "Short title of activity" },
            location: { type: Type.STRING, description: "Name of the place/area" },
            notes: { type: Type.STRING, description: "Helpful tip or transport info" },
            lat: { type: Type.NUMBER, description: "Latitude" },
            lng: { type: Type.NUMBER, description: "Longitude" },
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
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Suggest a realistic 1-day itinerary for Day ${day} of a trip to Seoul, South Korea. 
      ${areaPrompt}
      Context/Vibe: ${context}.
      Include estimated weather for this time of year (Spring/Autumn usually best).
      IMPORTANT: Provide accurate latitude (lat) and longitude (lng) for each location if possible.
      Return a JSON array of activities with times.`,
      config: schema
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

/**
 * 從文字中解析地點
 */
export const parseLocationsFromText = async (text: string): Promise<ParsedLocation[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME, 
      contents: `Extract all travel locations/places in Seoul mentioned in this text. 
      For each location, provide coordinates.
      Return a JSON array. 
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
              description: { type: Type.STRING, description: "Brief snippet about this place" }
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

/**
 * 計算路線選項
 */
export const calculateRoute = async (from: string, to: string): Promise<RouteOption[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `As a Seoul travel expert, estimate the travel time and best routes from "${from}" to "${to}" within Seoul. 
      Provide 3 options: one for Subway, one for Bus, and one for Walking. 
      Return a JSON array of route options.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: "Must be 'subway', 'bus', or 'walk'" },
              duration: { type: Type.STRING, description: "Estimated time, e.g., '15 mins'" },
              summary: { type: Type.STRING, description: "Short description, e.g., 'Line 4 (Blue)' or 'Direct walk'" }
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

/**
 * 從文字解析單一活動
 */
export const parseActivityFromText = async (text: string): Promise<Partial<ItineraryItem>> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analyze this text and extract a single travel itinerary activity item for a trip to Seoul.
      Text: "${text}"
      Return JSON.`,
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

/**
 * 與旅遊嚮導對話 (支援記憶功能)
 */
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
        systemInstruction: `You are a savvy local guide for Seoul, South Korea. 
        Focus on providing details that work well with Naver Maps. 
        You help tourists find great food, transport, and hidden gems. 
        Be extremely helpful and concise.`,
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
      text: "抱歉，我現在無法連接首爾導覽網路。請再試一次。",
      mapChunks: [],
      newHistory: history
    };
  }
};

// --- 其他輔助函式 ---

export const getCoordinatesForLocation = async (location: string): Promise<{lat: number, lng: number} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Get the accurate latitude and longitude for this place in Seoul: "${location}". 
      If it is a generic activity (e.g. "Lunch", "Rest", "Subway") without a specific location name, return null. 
      Return a JSON object with lat and lng.`,
      config: {
        responseMimeType:
