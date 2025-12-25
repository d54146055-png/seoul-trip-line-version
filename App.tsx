
import React, { useState, useEffect } from 'react';
import { AppTab, Expense, ItineraryItem, User } from './types';
import ItineraryView from './components/ItineraryView';
import ExpenseView from './components/ExpenseView';
import ChatView from './components/ChatView';
import MapView from './components/MapView';
import { Calendar, CreditCard, MessageCircle, MapPin, Users, Search } from 'lucide-react';
import { subscribeToExpenses, subscribeToItinerary, subscribeToUsers } from './services/firebaseService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.ITINERARY);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);

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
      case AppTab.ITINERARY: return <ItineraryView items={itineraryItems} />;
      case AppTab.MAP: return <MapView itineraryItems={itineraryItems} />;
      case AppTab.EXPENSES: return <ExpenseView expenses={expenses} users={users} />;
      case AppTab.AI_GUIDE: return <ChatView />;
      default: return <ItineraryView items={itineraryItems} />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-paper text-ink font-sans max-w-md mx-auto relative shadow-2xl border-x-2 border-ink overflow-hidden">
      
      {/* Header - Doodle Style */}
      <header className="flex-none bg-white z-20 px-4 pt-safe-top pb-2 border-b-2 border-ink flex justify-between items-center h-[calc(60px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
            <div className="border-2 border-ink p-1 rounded bg-marker text-white transform -rotate-2">
                <span className="font-hand font-bold text-lg">Seoul</span>
            </div>
            <h1 className="text-3xl font-hand font-bold text-ink transform rotate-1">Trip</h1>
        </div>
        
        {/* Right side: User Avatars only (Search bar removed) */}
        <div className="flex -space-x-2 ml-auto">
           {users.slice(0, 3).map((u, i) => (
               <div key={i} className="w-8 h-8 rounded-full bg-white border-2 border-ink flex items-center justify-center text-xs font-bold shadow-sm">
                   {u.name.charAt(0)}
               </div>
           ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative w-full bg-paper">
        {renderContent()}
      </main>

      {/* Bottom Nav - Thick Borders */}
      <nav className="flex-none bg-white border-t-2 border-ink pb-safe z-30">
        <div className="flex justify-around items-center h-[60px]">
          <button onClick={() => setActiveTab(AppTab.ITINERARY)} className={`transition-transform active:scale-95 ${activeTab === AppTab.ITINERARY ? 'text-marker' : 'text-gray-400'}`}>
            <Calendar size={28} strokeWidth={2.5} />
          </button>

          <button onClick={() => setActiveTab(AppTab.MAP)} className={`transition-transform active:scale-95 ${activeTab === AppTab.MAP ? 'text-marker' : 'text-gray-400'}`}>
            <MapPin size={28} strokeWidth={2.5} />
          </button>
          
          <button onClick={() => setActiveTab(AppTab.AI_GUIDE)} className="-mt-6">
            <div className={`w-14 h-14 rounded-full border-2 border-ink flex items-center justify-center shadow-doodle transition-transform active:translate-y-1 active:shadow-none ${activeTab === AppTab.AI_GUIDE ? 'bg-ink' : 'bg-white'}`}>
                <MessageCircle size={26} className={activeTab === AppTab.AI_GUIDE ? 'text-white' : 'text-ink'} strokeWidth={2.5} />
            </div>
          </button>

          <button onClick={() => setActiveTab(AppTab.EXPENSES)} className={`transition-transform active:scale-95 ${activeTab === AppTab.EXPENSES ? 'text-marker' : 'text-gray-400'}`}>
            <CreditCard size={28} strokeWidth={2.5} />
          </button>
          
          {/* User Icon removed from here */}
        </div>
      </nav>
    </div>
  );
};

export default App;
