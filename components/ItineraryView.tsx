
import React, { useState } from 'react';
import { ItineraryItem } from '../types';
// Fixed: Added Loader2 to the imports from lucide-react
import { Plus, Trash2, MapPin, Sparkles, Cloud, Sun, CloudRain, Snowflake, Wand2, ExternalLink, Loader2 } from 'lucide-react';
import { generateItinerarySuggestion } from '../services/geminiService';
import { addItineraryItem, deleteItineraryItem } from '../services/firebaseService';

interface Props {
  items: ItineraryItem[];
}

const ItineraryView: React.FC<Props> = ({ items }) => {
  const [selectedDay, setSelectedDay] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [newItem, setNewItem] = useState<Partial<ItineraryItem>>({ time: '09:00', day: 1 });
  const [targetAreas, setTargetAreas] = useState('');

  const dayItems = items
    .filter(i => i.day === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  const handleAddItem = async () => {
    if (newItem.activity && newItem.time) {
      try {
        await addItineraryItem({
          time: newItem.time!,
          activity: newItem.activity!,
          location: newItem.location || '',
          notes: newItem.notes || '',
          day: selectedDay,
          weather: { temp: 18, condition: 'sunny', icon: '☀️' }
        });
        setIsModalOpen(false);
        setNewItem({ time: '09:00', day: selectedDay });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("確定刪除此行程嗎？")) {
      await deleteItineraryItem(id);
    }
  };

  // Naver Map Link Generator
  const openNaverMap = (location: string) => {
    const query = encodeURIComponent(`${location} 首爾`);
    const url = `https://map.naver.com/v5/search/${query}`;
    window.open(url, '_blank');
  };

  const getWeatherIcon = (condition?: string) => {
    if (!condition) return <Sun size={14} className="text-orange-400" />;
    const c = condition.toLowerCase();
    if (c.includes('rain')) return <CloudRain size={14} className="text-blue-400" />;
    if (c.includes('snow')) return <Snowflake size={14} className="text-blue-200" />;
    if (c.includes('cloud')) return <Cloud size={14} className="text-gray-400" />;
    return <Sun size={14} className="text-orange-400" />;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
        const suggestedItems = await generateItinerarySuggestion(
            selectedDay, 
            "Aesthetic spots, hidden gems, good food, must-visit landmarks", 
            targetAreas
        );
        
        if (suggestedItems.length > 0) {
            for (const item of suggestedItems) {
                await addItineraryItem(item);
            }
        } else {
            alert("AI 無法生成計畫，請檢查 API Key 或稍後再試。");
        }
    } catch (e) {
        alert("AI 生成過程中發生錯誤。");
    } finally {
        setIsGenerating(false);
        setIsPlanModalOpen(false);
        setTargetAreas('');
    }
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-cream">
      {/* Day Selector - Sticky at the top of THIS scrollable container */}
      <div className="sticky top-0 z-10 bg-cream/95 backdrop-blur-md border-b border-sand p-4 overflow-x-auto no-scrollbar flex space-x-3 shadow-sm">
        {[1, 2, 3, 4, 5, 6, 7].map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`flex flex-col items-center justify-center min-w-[3.5rem] h-14 rounded-2xl transition-all ${
              selectedDay === day 
                ? 'bg-cocoa text-white shadow-lg scale-105' 
                : 'bg-white text-gray-400 border border-sand/50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold opacity-80">Day</span>
            <span className="text-lg font-bold font-serif">{day}</span>
          </button>
        ))}
      </div>

      <div className="p-5 space-y-6 pb-32"> {/* Increased bottom padding to ensure FAB and nav don't block content */}
        {dayItems.length === 0 ? (
          <div className="text-center py-20 opacity-60">
            <div className="w-16 h-16 bg-sand rounded-full mx-auto mb-4 flex items-center justify-center text-cocoa">
               <MapPin className="animate-bounce" />
            </div>
            <p className="mb-6 text-cocoa font-medium">第 {selectedDay} 天還沒有行程</p>
            <button 
              onClick={() => setIsPlanModalOpen(true)}
              className="inline-flex items-center px-6 py-3 bg-white border border-sand text-cocoa rounded-xl font-bold hover:bg-sand transition-colors shadow-sm active:scale-95"
            >
              <Wand2 size={18} className="mr-2 text-accent" />
              AI 規劃當天行程
            </button>
          </div>
        ) : (
          <div className="relative border-l border-dashed border-latte/30 ml-3 space-y-8 pb-4">
            <div className="flex justify-end mb-4 pr-1">
                <button 
                    onClick={() => setIsPlanModalOpen(true)}
                    className="text-xs bg-white border border-sand px-4 py-2 rounded-full text-cocoa hover:bg-sand flex items-center shadow-sm active:scale-95 transition-all"
                >
                    <Sparkles size={12} className="mr-1.5 text-accent"/> AI 追加建議
                </button>
            </div>

            {dayItems.map((item) => (
              <div key={item.id} className="relative pl-8 group">
                <div className="absolute -left-[6.5px] top-5 w-3 h-3 bg-cream border-2 border-cocoa rounded-full z-10"></div>
                
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-transparent hover:border-sand/50 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-serif text-2xl text-cocoa font-medium">{item.time}</span>
                    <div className="flex items-center space-x-2 bg-sand/30 px-3 py-1 rounded-full text-xs text-cocoa font-medium">
                       {getWeatherIcon(item.weather?.condition)}
                       <span>{item.weather?.temp ? `${item.weather.temp}°` : '18°'}</span>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-800 mb-1 leading-tight">{item.activity}</h3>
                  
                  <div 
                    onClick={() => openNaverMap(item.location)}
                    className="flex items-center text-latte text-sm mb-3 cursor-pointer hover:text-accent transition-colors group/link"
                  >
                    <MapPin size={14} className="mr-1 flex-shrink-0" />
                    <span className="underline decoration-dotted decoration-latte mr-1 truncate">{item.location}</span>
                    <ExternalLink size={10} className="opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  
                  {item.notes && (
                    <div className="text-xs text-gray-500 bg-cream p-3 rounded-xl italic border border-sand/30">
                      "{item.notes}"
                    </div>
                  )}

                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                      </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-cocoa text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-latte transition-all active:scale-90 z-20"
      >
        <Plus size={28} />
      </button>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-cocoa/20 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-[float_0.3s_ease-out]">
            <h2 className="text-xl font-serif font-bold text-cocoa mb-6 text-center">新增行程</h2>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                 <div className="w-1/3">
                    <label className="block text-xs font-bold text-latte uppercase mb-1">時間</label>
                    <input 
                      type="time" 
                      className="w-full p-3 bg-cream rounded-xl text-cocoa font-bold text-center focus:outline-none"
                      value={newItem.time}
                      onChange={e => setNewItem({...newItem, time: e.target.value})}
                    />
                 </div>
                 <div className="flex-1">
                    <label className="block text-xs font-bold text-latte uppercase mb-1">活動</label>
                    <input 
                      type="text" 
                      placeholder="例如：咖啡廳..."
                      className="w-full p-3 bg-cream rounded-xl text-cocoa focus:outline-none"
                      value={newItem.activity || ''}
                      onChange={e => setNewItem({...newItem, activity: e.target.value})}
                    />
                 </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-latte uppercase mb-1">地點 (Naver Map)</label>
                <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-3.5 text-latte" />
                    <input 
                    type="text" 
                    placeholder="輸入地點名稱"
                    className="w-full p-3 pl-10 bg-cream rounded-xl text-cocoa focus:outline-none"
                    value={newItem.location || ''}
                    onChange={e => setNewItem({...newItem, location: e.target.value})}
                    />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-latte uppercase mb-1">備註</label>
                <textarea 
                  placeholder="補充說明..."
                  className="w-full p-3 bg-cream rounded-xl text-cocoa focus:outline-none resize-none h-20"
                  value={newItem.notes || ''}
                  onChange={e => setNewItem({...newItem, notes: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-latte font-medium hover:bg-cream rounded-xl">取消</button>
              <button onClick={handleAddItem} className="flex-1 py-3 bg-cocoa text-white font-bold rounded-xl shadow-lg active:scale-95">確認新增</button>
            </div>
          </div>
        </div>
      )}

      {/* Magic AI Plan Modal */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-cocoa/30 z-[60] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-latte rounded-t-[2rem]"></div>
                
                <h2 className="text-2xl font-serif font-bold text-cocoa mb-2 text-center flex items-center justify-center gap-2">
                    <Sparkles size={24} className="text-accent" />
                    AI 規劃師
                </h2>
                <p className="text-center text-xs text-gray-400 mb-6">輸入想去的區域，AI 將自動排程。</p>

                <div className="bg-cream p-4 rounded-xl border border-sand mb-6">
                    <label className="block text-xs font-bold text-latte uppercase mb-2">想去的區域或關鍵字</label>
                    <textarea 
                        className="w-full bg-white p-3 rounded-lg text-cocoa text-sm focus:outline-none resize-none h-24"
                        placeholder="例如：弘大逛街、延南洞咖啡廳..."
                        value={targetAreas}
                        onChange={(e) => setTargetAreas(e.target.value)}
                    />
                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !targetAreas}
                    className="w-full py-4 bg-cocoa text-white font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            正在規劃中...
                        </>
                    ) : (
                        '生成行程規劃'
                    )}
                </button>
                <button onClick={() => setIsPlanModalOpen(false)} className="w-full mt-3 text-xs text-gray-400 py-2 hover:text-cocoa">
                    返回
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default ItineraryView;
