
import React, { useState, useEffect } from 'react';
import { AppTab, Expense, ItineraryItem, User } from './types';
import ItineraryView from './components/ItineraryView';
import ExpenseView from './components/ExpenseView';
import ChatView from './components/ChatView';
import MapView from './components/MapView';
import { Calendar, CreditCard, MessageCircle, MapPin, Users } from 'lucide-react';
import { subscribeToExpenses, subscribeToItinerary, subscribeToUsers } from './services/firebaseService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.ITINERARY);
  
  // Real-time Data from Firebase or LocalStorage
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Handle Data Sync (Always Active)
  useEffect(() => {
    const unsubscribeItinerary = subscribeToItinerary(setItineraryItems);
    const unsubscribeExpenses = subscribeToExpenses(setExpenses);
    const unsubscribeUsers = subscribeToUsers(setUsers);

    return () => {
      unsubscribeItinerary();
      unsubscribeExpenses();
      unsubscribeUsers();
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.ITINERARY:
        return <ItineraryView items={itineraryItems} />;
      case AppTab.MAP:
        return <MapView itineraryItems={itineraryItems} />;
      case AppTab.EXPENSES:
        return <ExpenseView expenses={expenses} users={users} />;
      case AppTab.AI_GUIDE:
        return <ChatView />;
      default:
        return <ItineraryView items={itineraryItems} />;
    }
  };

  // Main App
  return (
    <div className="h-full flex flex-col bg-cream text-cocoa font-sans max-w-md mx-auto relative shadow-2xl border-x border-sand/50 overflow-hidden">
      {/* Header - Fixed */}
      <header className="flex-none bg-cream/95 backdrop-blur-md z-20 px-6 pt-safe-top pb-3 border-b border-sand/30 flex justify-between items-center h-[calc(60px+env(safe-area-inset-top))]">
        <div className="pt-2">
          <h1 className="text-2xl font-serif font-bold text-cocoa leading-none">
            Seoul<span className="text-accent">Mate</span>.
          </h1>
          <div className="flex items-center gap-2 mt-1">
             <div className="flex -space-x-1">
                {users.slice(0, 3).map((u, i) => (
                    <div key={i} className="w-5 h-5 rounded-full bg-latte border-2 border-cream text-[9px] flex items-center justify-center text-white uppercase overflow-hidden shadow-sm font-bold">
                        {u.name.charAt(0)}
                    </div>
                ))}
                {users.length === 0 && (
                    <div className="w-5 h-5 rounded-full bg-sand/50 border-2 border-cream flex items-center justify-center text-cocoa">
                        <Users size={10} />
                    </div>
                )}
             </div>
             <p className="text-[10px] text-latte font-bold tracking-[0.2em] uppercase">
                {users.length > 0 ? `${users.length} Travelers` : 'My Trip'}
             </p>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-hidden relative w-full">
        {renderContent()}
      </main>

      {/* Bottom Navigation - Fixed */}
      <nav className="flex-none bg-white/95 backdrop-blur-lg border-t border-sand pb-safe z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[2rem] h-[calc(70px+env(safe-area-inset-bottom))]">
        <div className="flex justify-around items-start h-full pt-3 px-4">
          <button 
            onClick={() => setActiveTab(AppTab.ITINERARY)}
            className={`flex flex-col items-center justify-center w-16 space-y-1 transition-colors ${activeTab === AppTab.ITINERARY ? 'text-cocoa' : 'text-gray-300 hover:text-latte'}`}
          >
            <Calendar size={22} strokeWidth={activeTab === AppTab.ITINERARY ? 2.5 : 2} />
            <span className="text-[9px] font-bold tracking-wide">PLAN</span>
          </button>

          <button 
            onClick={() => setActiveTab(AppTab.MAP)}
            className={`flex flex-col items-center justify-center w-16 space-y-1 transition-colors ${activeTab === AppTab.MAP ? 'text-cocoa' : 'text-gray-300 hover:text-latte'}`}
          >
            <MapPin size={22} strokeWidth={activeTab === AppTab.MAP ? 2.5 : 2} />
            <span className="text-[9px] font-bold tracking-wide">MAP</span>
          </button>
          
          <button 
            onClick={() => setActiveTab(AppTab.AI_GUIDE)}
            className="flex flex-col items-center justify-center w-16 -mt-8"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${activeTab === AppTab.AI_GUIDE ? 'bg-cocoa scale-110 ring-4 ring-cream' : 'bg-cocoa hover:bg-latte'}`}>
                <MessageCircle size={26} className="text-white" fill="white" />
            </div>
            <span className={`text-[9px] font-bold mt-2 ${activeTab === AppTab.AI_GUIDE ? 'text-cocoa' : 'text-gray-300'}`}>AI</span>
          </button>

          <button 
            onClick={() => setActiveTab(AppTab.EXPENSES)}
            className={`flex flex-col items-center justify-center w-16 space-y-1 transition-colors ${activeTab === AppTab.EXPENSES ? 'text-cocoa' : 'text-gray-300 hover:text-latte'}`}
          >
            <CreditCard size={22} strokeWidth={activeTab === AppTab.EXPENSES ? 2.5 : 2} />
            <span className="text-[9px] font-bold tracking-wide">MONEY</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
