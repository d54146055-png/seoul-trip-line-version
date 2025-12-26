import { GoogleGenAI, Type } from "@google/genai";
import { ItineraryItem, ParsedLocation } from "../types";


const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Gemini API Key is missing! Please check Vercel environment variables.");
}

const AVAILABLE_IMAGES = [
  "assets/seoul_1.jpg",
  "assets/seoul_2.jpg",
  "assets/seoul_3.jpg",
  "assets/seoul_4.jpg",
  "assets/seoul_5.jpg"
];

// Fixed: Strictly following guidelines for GoogleGenAI initialization
const ai = new GoogleGenAI({ apiKey: API_KEY || "" });

export const generateItinerarySuggestion = async (day: number, context: string, areas?: string): Promise<Omit<ItineraryItem, 'id'>[]> => {
  try {
    const areaPrompt = areas ? `Specifically focusing on these areas/districts: ${areas}. Arrange the route logically to minimize travel time between these districts.` : '';
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Suggest a realistic 1-day itinerary for Day ${day} of a trip to Seoul, South Korea. 
      ${areaPrompt}
      Context/Vibe: ${context}.
      Include estimated weather for this time of year (Spring/Autumn usually best).
      IMPORTANT: Provide accurate latitude (lat) and longitude (lng) for each location if possible.
      
      *** IMPORTANT IMAGE RULE ***
      For the 'image' field, you MUST select one image randomly from this exact list: ${AVAILABLE_IMAGES.join(", ")}.
      Do NOT invent new filenames.
      ***************************

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
              lat: { type: Type.NUMBER, description: "Latitude of the location" },
              lng: { type: Type.NUMBER, description: "Longitude of the location" },
              // 這裡強制 AI 只能選清單裡的圖片
              image: { 
                type: Type.STRING, 
                enum: AVAILABLE_IMAGES,
                description: "Path to a valid asset image"
              },
              weather: {
                type: Type.OBJECT,
                properties: {
                  temp: { type: Type.NUMBER, description: "Temperature in Celsius" },
                  condition: { type: Type.STRING, description: "One of: sunny, cloudy, rainy, snowy" },
                  icon: { type: Type.STRING, description: "Emoji representing weather" }
                }
              }
            },
            required: ["time", "activity", "location", "image"]
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
      model: "gemini-2.5-flash",
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
      model: "gemini-2.5-flash",
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
      model: "gemini-2.5-flash",
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
      model: "gemini-2.5-flash",
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

// --- NEW FUNCTIONS ---

export const getCoordinatesForLocation = async (location: string): Promise<{lat: number, lng: number} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Get the accurate latitude and longitude for this place in Seoul: "${location}". 
      If it is a generic activity (e.g. "Lunch", "Rest", "Subway") without a specific location name, return null. 
      Return a JSON object with lat and lng.`,
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
    // Check if empty or null text
    if (!response.text) return null;
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Geocoding Error:", error);
    return null;
  }
};

export const generateNextActivitySuggestion = async (currentItems: ItineraryItem[]): Promise<Partial<ItineraryItem> | null> => {
  try {
    const context = currentItems.map(i => `${i.time}: ${i.activity} at ${i.location}`).join('\n');
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Given this itinerary for a day in Seoul:\n${context}\n\nSuggest ONE next logical activity or place nearby. Return JSON.`,
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
    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("Suggestion Error:", error);
    return null;
  }
};
