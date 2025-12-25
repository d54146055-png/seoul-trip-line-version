
import { GoogleGenAI, Type } from "@google/genai";
import { ItineraryItem, ParsedLocation } from "../types";

// Fixed: Strictly following guidelines for GoogleGenAI initialization
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateItinerarySuggestion = async (day: number, context: string, areas?: string): Promise<Omit<ItineraryItem, 'id'>[]> => {
  try {
    const areaPrompt = areas ? `Specifically focusing on these areas/districts: ${areas}. Arrange the route logically to minimize travel time between these districts.` : '';
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest a realistic 1-day itinerary for Day ${day} of a trip to Seoul, South Korea. 
      ${areaPrompt}
      Context/Vibe: ${context}.
      Include estimated weather for this time of year (Spring/Autumn usually best).
      Return a JSON array of activities with times.`,
      config: {
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
              weather: {
                type: Type.OBJECT,
                properties: {
                  temp: { type: Type.NUMBER, description: "Temperature in Celsius" },
                  condition: { type: Type.STRING, description: "One of: sunny, cloudy, rainy, snowy" },
                  icon: { type: Type.STRING, description: "Emoji representing weather" }
                }
              }
            },
            required: ["time", "activity", "location"]
          }
        }
      }
    });

    const items = JSON.parse(response.text || "[]");
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
      model: "gemini-3-flash-preview",
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
    
    return JSON.parse(response.text || "[]");
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
      model: "gemini-3-flash-preview",
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
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Route calculation error:", e);
    return [];
  }
};

export const parseActivityFromText = async (text: string): Promise<Partial<ItineraryItem>> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { activity: "New Activity", time: "10:00" };
  }
}

export const chatWithTravelGuide = async (
  message: string, 
  location?: { lat: number; lng: number }
) => {
  try {
    // Fixed: Incorporating user location into the prompt for context and extracting grounding chunks
    const prompt = location 
      ? `(User is currently at ${location.lat}, ${location.lng}) ${message}`
      : message;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: `You are a savvy local guide for Seoul, South Korea. 
        Focus on providing details that work well with Naver Maps. 
        You help tourists find great food, transport, and hidden gems. 
        Be extremely helpful and concise.`,
        tools: [{ googleSearch: {} }],
      }
    });

    // Extract grounding chunks as required for googleSearch tool
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
    console.error("Chat Error:", error);
    return {
      text: "抱歉，我現在無法連接首爾導覽網路。請再試一次。",
      mapChunks: []
    };
  }
};
