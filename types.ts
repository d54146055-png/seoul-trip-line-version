
export interface WeatherInfo {
  temp: number;
  condition: string; // 'sunny', 'cloudy', 'rainy', 'snowy'
  icon: string;
}

export interface ItineraryItem {
  id: string;
  time: string;
  activity: string;
  location: string;
  notes?: string;
  day: number;
  lat?: number;
  lng?: number;
  weather?: WeatherInfo;
  imageUrl?: string; // New field for custom images
}

export interface Expense {
  id: string;
  payer: string;
  amount: number;
  description: string;
  date: string;
  involved: string[]; // List of names sharing this expense
}

export interface User {
  id: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isLoading?: boolean;
  mapChunks?: Array<{
    source: {
      title: string;
      uri: string;
    }
  }>;
}

export interface ParsedLocation {
  name: string;
  lat: number;
  lng: number;
  description: string;
}

export interface MapMarker extends ParsedLocation {
  id: string;
  type: 'search' | 'itinerary';
  time?: string;
  day?: number;
  timestamp: number;
}

export enum AppTab {
  ITINERARY = 'ITINERARY',
  MAP = 'MAP',
  EXPENSES = 'EXPENSES',
  AI_GUIDE = 'AI_GUIDE',
}
