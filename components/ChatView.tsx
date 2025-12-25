
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

  useEffect(() => {
    const unsubscribe = subscribeToChat((msgs) => {
        setMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Omit<ChatMessage, 'id'> = { 
        role: 'user', 
        text: input, 
        timestamp: Date.now() 
    };
    await sendChatMessage(userMsg);
    
    setInput('');
    setLoading(true);

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

    const response = await chatWithTravelGuide(userMsg.text, location);
    
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
      const parsedData = await parseActivityFromText(msg.text);
      setImportModalData({ ...parsedData, day: 1 });
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
    <div className="flex flex-col h-full bg-paper">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-10">
                <Bot size={48} className="mx-auto mb-2 text-ink/30" />
                <p className="font-hand text-xl text-ink">Start planning your trip...</p>
            </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`flex max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-2 items-end group`}>
                <div className={`w-8 h-8 rounded-full border-2 border-ink flex items-center justify-center flex-shrink-0 mb-1 bg-white`}>
                    {msg.role === 'user' ? <UserIcon size={16} className="text-ink"/> : <Bot size={16} className="text-marker"/>}
                </div>
                
                <div className="flex flex-col gap-1">
                    <div className={`p-3 border-2 border-ink text-sm leading-relaxed shadow-doodle-sm ${
                        msg.role === 'user' 
                        ? 'bg-ink text-white rounded-l-xl rounded-tr-xl' 
                        : 'bg-white text-ink rounded-r-xl rounded-tl-xl'
                    }`}>
                        {msg.text}
                        
                        {msg.mapChunks && msg.mapChunks.length > 0 && (
                            <div className="mt-3 pt-3 border-t-2 border-dashed border-gray-200 space-y-2">
                                <p className="text-xs font-bold uppercase flex items-center">
                                    <MapPin size={10} className="mr-1"/> Found Places
                                </p>
                                {msg.mapChunks.map((chunk, idx) => (
                                    <a 
                                        key={idx} 
                                        href={chunk.source.uri} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="block bg-gray-50 p-2 rounded border border-ink/30 hover:bg-yellow-50 transition-colors text-ink text-xs truncate flex items-center font-bold"
                                    >
                                        <Map size={12} className="mr-2 flex-shrink-0"/>
                                        {chunk.source.title}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {msg.role === 'model' && (
                        <button 
                            onClick={() => handleAddToItinerary(msg)}
                            disabled={importingMsgId === msg.id}
                            className="self-start ml-1 mt-1 text-xs text-ink bg-white border border-ink hover:bg-gray-50 px-2 py-1 rounded-lg flex items-center transition-colors shadow-sm font-bold"
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
                <div className="bg-white border-2 border-ink p-3 rounded-xl rounded-tl-none shadow-sm flex items-center gap-2 ml-10">
                    <Loader2 size={16} className="animate-spin text-marker" />
                    <span className="text-xs font-bold text-ink">Thinking...</span>
                </div>
            </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t-2 border-ink z-10">
        <div className="flex gap-2">
            <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask Seoul Mate..."
                className="flex-1 bg-paper border-2 border-ink text-ink placeholder-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:shadow-doodle-sm transition-all text-sm font-bold"
            />
            <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-12 h-12 bg-ink border-2 border-ink rounded-xl flex items-center justify-center text-white shadow-doodle disabled:opacity-50 disabled:shadow-none transition-all active:translate-y-1 active:shadow-none flex-shrink-0"
            >
                <Send size={18} />
            </button>
        </div>
      </div>

      {/* Import Modal */}
      {importModalData && (
          <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-white border-2 border-ink rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-[float_0.3s_ease-out]">
                  <h3 className="text-xl font-hand font-bold text-ink mb-4 text-center">Add to Itinerary</h3>
                  
                  <div className="space-y-4 bg-paper p-4 rounded-xl border-2 border-ink">
                      <div>
                          <label className="text-[10px] font-bold text-ink uppercase">Activity</label>
                          <input 
                              value={importModalData.activity} 
                              onChange={e => setImportModalData({...importModalData, activity: e.target.value})}
                              className="w-full bg-white p-2 rounded-lg text-ink font-bold text-sm mt-1 border-2 border-ink focus:outline-none"
                          />
                      </div>
                      <div className="flex gap-3">
                          <div className="flex-1">
                              <label className="text-[10px] font-bold text-ink uppercase">Time</label>
                              <input 
                                  type="time"
                                  value={importModalData.time} 
                                  onChange={e => setImportModalData({...importModalData, time: e.target.value})}
                                  className="w-full bg-white p-2 rounded-lg text-ink text-sm mt-1 border-2 border-ink focus:outline-none"
                              />
                          </div>
                          <div className="flex-1">
                              <label className="text-[10px] font-bold text-ink uppercase">Day</label>
                              <select 
                                  value={importModalData.day}
                                  onChange={e => setImportModalData({...importModalData, day: Number(e.target.value)})}
                                  className="w-full bg-white p-2 rounded-lg text-ink text-sm mt-1 border-2 border-ink focus:outline-none appearance-none font-bold"
                              >
                                  {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>Day {d}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-ink uppercase">Location</label>
                          <input 
                              value={importModalData.location} 
                              onChange={e => setImportModalData({...importModalData, location: e.target.value})}
                              className="w-full bg-white p-2 rounded-lg text-ink text-sm mt-1 border-2 border-ink focus:outline-none"
                          />
                      </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                      <button 
                          onClick={() => setImportModalData(null)}
                          className="flex-1 py-3 text-ink font-bold hover:bg-gray-100 rounded-xl border-2 border-transparent hover:border-ink"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={confirmImport}
                          className="flex-1 py-3 bg-marker text-white font-bold rounded-xl shadow-doodle border-2 border-ink hover:bg-red-600 transition-colors flex items-center justify-center active:translate-y-1 active:shadow-none"
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
