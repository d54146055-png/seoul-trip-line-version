
import { db, TRIP_ID, isFirebaseConfigured } from '../firebaseConfig';
import { collection, doc, onSnapshot, addDoc, deleteDoc, updateDoc, query, orderBy, limit, writeBatch, getDocs } from 'firebase/firestore';
import { ItineraryItem, Expense, User, ChatMessage, MapMarker } from '../types';

// ==========================================
// HYBRID SERVICE IMPLEMENTATION
// Automatically switches between Cloud (Firestore) and Local (LocalStorage)
// ==========================================

const useCloud = isFirebaseConfigured && db;

// --- Observer System ---
type Listener<T> = (data: T[]) => void;
const observers: Record<string, Listener<any>[]> = {
  itinerary: [],
  expenses: [],
  users: [],
  chat: [],
  markers: []
};

const notify = <T>(key: string, data: T[]) => {
  if (observers[key]) {
    observers[key].forEach(callback => callback(data));
  }
};

const subscribeLocal = <T>(key: string, callback: Listener<T>) => {
  if (!observers[key]) observers[key] = [];
  observers[key].push(callback);
  const currentData = getLocal<T>(key);
  callback(currentData);
  return () => {
    observers[key] = observers[key].filter(cb => cb !== callback);
  };
};

const getLocal = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(`${TRIP_ID}_${key}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const setLocal = (key: string, data: any[]) => {
  localStorage.setItem(`${TRIP_ID}_${key}`, JSON.stringify(data));
  notify(key, data);
};

const handleCloudError = (error: any) => {
  console.error("Firebase Error:", error);
};

// --- Itinerary ---
export const subscribeToItinerary = (callback: (items: ItineraryItem[]) => void) => {
  if (useCloud) {
    const q = query(collection(db, 'trips', TRIP_ID, 'itinerary'));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItineraryItem));
      callback(items);
    });
  } else {
    return subscribeLocal<ItineraryItem>('itinerary', callback);
  }
};

export const addItineraryItem = async (item: Omit<ItineraryItem, 'id'>) => {
  if (useCloud) {
    try { await addDoc(collection(db, 'trips', TRIP_ID, 'itinerary'), item); } catch (e) { handleCloudError(e); throw e; }
  } else {
    const items = getLocal<ItineraryItem>('itinerary');
    const newItem = { ...item, id: Date.now().toString() } as ItineraryItem;
    setLocal('itinerary', [...items, newItem]);
  }
};

export const deleteItineraryItem = async (id: string) => {
  if (useCloud) {
    try { await deleteDoc(doc(db, 'trips', TRIP_ID, 'itinerary', id)); } catch (e) { handleCloudError(e); }
  } else {
    const items = getLocal<ItineraryItem>('itinerary');
    setLocal('itinerary', items.filter(i => i.id !== id));
  }
};

// --- Map Markers (NEW Persistent Collection) ---
export const subscribeToMarkers = (callback: (markers: MapMarker[]) => void) => {
  if (useCloud) {
    const q = query(collection(db, 'trips', TRIP_ID, 'mapMarkers'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MapMarker));
      callback(items);
    });
  } else {
    return subscribeLocal<MapMarker>('markers', callback);
  }
};

export const addMapMarker = async (marker: Omit<MapMarker, 'id'>) => {
  if (useCloud) {
    try { await addDoc(collection(db, 'trips', TRIP_ID, 'mapMarkers'), marker); } catch (e) { handleCloudError(e); }
  } else {
    const items = getLocal<MapMarker>('markers');
    const newItem = { ...marker, id: Date.now().toString() } as MapMarker;
    setLocal('markers', [...items, newItem]);
  }
};

export const clearAllMarkers = async () => {
  if (useCloud) {
    try {
      const q = query(collection(db, 'trips', TRIP_ID, 'mapMarkers'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) { handleCloudError(e); }
  } else {
    setLocal('markers', []);
  }
};

// --- Expenses ---
export const subscribeToExpenses = (callback: (expenses: Expense[]) => void) => {
  if (useCloud) {
    const q = query(collection(db, 'trips', TRIP_ID, 'expenses'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      callback(items);
    });
  } else {
    return subscribeLocal<Expense>('expenses', callback);
  }
};

export const addExpenseItem = async (item: Omit<Expense, 'id'>) => {
  if (useCloud) {
    try { await addDoc(collection(db, 'trips', TRIP_ID, 'expenses'), item); } catch (e) { handleCloudError(e); throw e; }
  } else {
    const items = getLocal<Expense>('expenses');
    const newItem = { ...item, id: Date.now().toString() } as Expense;
    setLocal('expenses', [newItem, ...items]);
  }
};

export const deleteExpenseItem = async (id: string) => {
  if (useCloud) {
    try { await deleteDoc(doc(db, 'trips', TRIP_ID, 'expenses', id)); } catch (e) { handleCloudError(e); }
  } else {
    const items = getLocal<Expense>('expenses');
    setLocal('expenses', items.filter(i => i.id !== id));
  }
};

// --- Users ---
export const subscribeToUsers = (callback: (users: User[]) => void) => {
    if (useCloud) {
      const q = query(collection(db, 'trips', TRIP_ID, 'users'));
      return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        callback(items);
      });
    } else {
      return subscribeLocal<User>('users', callback);
    }
};

export const addUser = async (name: string) => {
    if (useCloud) {
      try { await addDoc(collection(db, 'trips', TRIP_ID, 'users'), { name }); } catch (e) { handleCloudError(e); }
    } else {
      const items = getLocal<User>('users');
      if (!items.find(u => u.name === name)) {
        const newItem = { id: Date.now().toString(), name };
        setLocal('users', [...items, newItem]);
      }
    }
};

export const updateUser = async (id: string, newName: string) => {
    if (useCloud) {
        try { await updateDoc(doc(db, 'trips', TRIP_ID, 'users', id), { name: newName }); } catch (e) { handleCloudError(e); }
    } else {
        const items = getLocal<User>('users');
        const updated = items.map(u => u.id === id ? { ...u, name: newName } : u);
        setLocal('users', updated);
    }
};

export const deleteUser = async (id: string) => {
    if (useCloud) {
        try { await deleteDoc(doc(db, 'trips', TRIP_ID, 'users', id)); } catch (e) { handleCloudError(e); }
    } else {
        const items = getLocal<User>('users');
        setLocal('users', items.filter(u => u.id !== id));
    }
};

// --- Chat ---
export const subscribeToChat = (callback: (messages: ChatMessage[]) => void) => {
    if (useCloud) {
      const q = query(collection(db, 'trips', TRIP_ID, 'chat'), orderBy('timestamp', 'asc'), limit(50));
      return onSnapshot(q, (snapshot) => {
          const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
          callback(items);
      });
    } else {
      const loadLocalChat = (data: ChatMessage[]) => {
          const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
          callback(sorted);
      };
      return subscribeLocal<ChatMessage>('chat', loadLocalChat);
    }
};

export const sendChatMessage = async (message: Omit<ChatMessage, 'id'>) => {
    if (useCloud) {
      try { await addDoc(collection(db, 'trips', TRIP_ID, 'chat'), message); } catch (e) { handleCloudError(e); }
    } else {
      const items = getLocal<ChatMessage>('chat');
      const newItem = { ...message, id: Date.now().toString() } as ChatMessage;
      const updated = [...items, newItem].slice(-50);
      setLocal('chat', updated);
    }
};
