import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ItineraryItem } from '../types';
import { Send, Map, Bot, User as UserIcon, Loader2, MapPin, CalendarPlus, Check } from 'lucide-react';
import { chatWithTravelGuide, parseActivityFromText } from '../services/geminiService';
import { subscribeToChat, sendChatMessage, addItineraryItem } from '../services/firebaseService';

const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Import Flow State
  const [importingMsgId, setImportingMsgId] = useState<string | null>(null);
  const [importModalData, setImportModalData] = useState<Partial<ItineraryItem> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to persistent chat
  useEffect(() => {
    const unsubscribe = subscribeToChat((msgs) => {
        setMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // 1. Send User Message
    const userMsg: Omit<ChatMessage, 'id'> = { 
        role: 'user', 
        text: input, 
        timestamp: Date.now() 
    };
    await sendChatMessage(userMsg);
    
    setInput('');
    setLoading(true);

    // 2. Get Location
    let location;
    if (navigator.geolocation) {
       try {
         const pos: GeolocationPosition = await new Promise((resolve, reject) => 
            navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 5000})
         );
         location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
       } catch (e) {
         // ignore location error
       }
    }

    // 3. Call AI
    const response = await chatWithTravelGuide(userMsg.text, location);
    
    // 4. Save Model Response
    await sendChatMessage({
      role: 'model',
      text: response.text || "I couldn't find an answer to that.",
      mapChunks: response.mapChunks,
      timestamp: Date.now()
    });
    
    setLoading(false);
  };

  const handleAddToItinerary = async (msg: ChatMessage) => {
      setImportingMsgId(msg.id);
      
      // AI Parse
      const parsedData = await parseActivityFromText(msg.text);
      
      setImportModalData({
          ...parsedData,
          day: 1 // Default to Day 1
      });
      setImportingMsgId(null);
  };

  const confirmImport = async () => {
      if (importModalData && importModalData.activity && importModalData.time) {
          await addItineraryItem({
              activity: importModalData.activity,
              time: importModalData.time,
              location: importModalData.location || '',
              day: importModalData.day || 1,
              notes: importModalData.notes || 'Imported from AI Chat',
              weather: { temp: 20, condition: 'sunny', icon: '☀️' }
          });
          setImportModalData(null);
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages Area - Flex Grow to take available space */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-10">
                <Bot size={48} className="mx-auto mb-2 text-gray-300" />
                <p>Start planning your trip...</p>
            </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`flex max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-2 items-end group`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-1 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-500'}`}>
                    {msg.role === 'user' ? <UserIcon size={16} className="text-white"/> : <Bot size={16} className="text-white"/>}
                </div>
                
                <div className="flex flex-col gap-1">
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                    }`}>
                        {msg.text}
                        
                        {/* Render Map Links if available */}
                        {msg.mapChunks && msg.mapChunks.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                <p className="text-xs font-bold text-gray-400 uppercase flex items-center">
                                    <MapPin size={10} className="mr-1"/> Found Places
                                </p>
                                {msg.mapChunks.map((chunk, idx) => (
                                    <a 
                                        key={idx} 
                                        href={chunk.source.uri} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="block bg-gray-50 p-2 rounded hover:bg-indigo-50 transition-colors text-indigo-600 text-xs truncate flex items-center"
                                    >
                                        <Map size={12} className="mr-2 flex-shrink-0"/>
                                        {chunk.source.title}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add to Plan Button for AI messages */}
                    {msg.role === 'model' && (
                        <button 
                            onClick={() => handleAddToItinerary(msg)}
                            disabled={importingMsgId === msg.id}
                            className="self-start ml-1 mt-1 text-xs text-cocoa bg-sand/30 hover:bg-sand/50 px-2 py-1 rounded-full flex items-center transition-colors opacity-0 group-hover:opacity-100"
                        >
                            {importingMsgId === msg.id ? (
                                <Loader2 size={10} className="animate-spin mr-1"/>
                            ) : (
                                <CalendarPlus size={10} className="mr-1"/>
                            )}
                            Add to Plan
                        </button>
                    )}
                </div>
             </div>
          </div>
        ))}
        {loading && (
            <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 ml-10">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    <span className="text-xs text-gray-400">Thinking...</span>
                </div>
            </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area - Stays visible at bottom of flex container */}
      <div className="p-3 bg-white border-t border-gray-100 z-10">
        <div className="flex gap-2">
            <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask Seoul Mate..."
                className="flex-1 bg-gray-100 text-gray-900 placeholder-gray-400 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
            />
            <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-11 h-11 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex-shrink-0"
            >
                <Send size={18} />
            </button>
        </div>
      </div>

      {/* Import Confirmation Modal */}
      {importModalData && (
          <div className="fixed inset-0 bg-cocoa/40 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-[float_0.3s_ease-out]">
                  <h3 className="text-lg font-serif font-bold text-cocoa mb-4 text-center">Add to Itinerary</h3>
                  
                  <div className="space-y-4 bg-cream p-4 rounded-xl border border-sand/50">
                      <div>
                          <label className="text-[10px] font-bold text-latte uppercase">Activity</label>
                          <input 
                              value={importModalData.activity} 
                              onChange={e => setImportModalData({...importModalData, activity: e.target.value})}
                              className="w-full bg-white p-2 rounded-lg text-cocoa font-bold text-sm mt-1 border border-sand focus:outline-none focus:border-cocoa"
                          />
                      </div>
                      <div className="flex gap-3">
                          <div className="flex-1">
                              <label className="text-[10px] font-bold text-latte uppercase">Time</label>
                              <input 
                                  type="time"
                                  value={importModalData.time} 
                                  onChange={e => setImportModalData({...importModalData, time: e.target.value})}
                                  className="w-full bg-white p-2 rounded-lg text-cocoa text-sm mt-1 border border-sand focus:outline-none"
                              />
                          </div>
                          <div className="flex-1">
                              <label className="text-[10px] font-bold text-latte uppercase">Day</label>
                              <select 
                                  value={importModalData.day}
                                  onChange={e => setImportModalData({...importModalData, day: Number(e.target.value)})}
                                  className="w-full bg-white p-2 rounded-lg text-cocoa text-sm mt-1 border border-sand focus:outline-none appearance-none"
                              >
                                  {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>Day {d}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-latte uppercase">Location</label>
                          <input 
                              value={importModalData.location} 
                              onChange={e => setImportModalData({...importModalData, location: e.target.value})}
                              className="w-full bg-white p-2 rounded-lg text-cocoa text-sm mt-1 border border-sand focus:outline-none"
                          />
                      </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                      <button 
                          onClick={() => setImportModalData(null)}
                          className="flex-1 py-3 text-gray-400 font-bold hover:bg-gray-50 rounded-xl"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={confirmImport}
                          className="flex-1 py-3 bg-cocoa text-white font-bold rounded-xl shadow-lg hover:bg-latte transition-colors flex items-center justify-center"
                      >
                          <Check size={18} className="mr-2"/> Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default ChatView;