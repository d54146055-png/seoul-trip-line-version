
import React, { useState, useEffect } from 'react';
import { ItineraryItem } from '../types';
import { Plus, Trash2, Wand2, Loader2, Sparkles, ChevronUp, Calendar, Edit2, ArrowRight, MapPin } from 'lucide-react';
import { generateItinerarySuggestion, generateNextActivitySuggestion, getCoordinatesForLocation } from '../services/geminiService';
import { addItineraryItem, deleteItineraryItem, updateItineraryItem, subscribeToTripSettings, updateTripSettings } from '../services/firebaseService';
import { ICON_STAR, ICON_PAGODA, ICON_LION, ICON_THUMB_BEAR, ICON_SQUARE_CAT, ICON_HEART_DOODLE, ICON_SPARKLE } from '../utils/icons';

interface Props {
  items: ItineraryItem[];
}

const ItineraryView: React.FC<Props> = ({ items }) => {
  const [selectedDay, setSelectedDay] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  // New Item State (for Add and Edit)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<ItineraryItem>>({ time: '09:00', day: 1 });
  const [isSaving, setIsSaving] = useState(false);
  
  const [targetAreas, setTargetAreas] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAppending, setIsAppending] = useState(false); 
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Trip Settings
  const [tripStartDate, setTripStartDate] = useState<string>('');
  const [tripEndDate, setTripEndDate] = useState<string>('');
  
  useEffect(() => {
      const unsubscribe = subscribeToTripSettings((settings) => {
          if (settings.startDate) setTripStartDate(settings.startDate);
          if (settings.endDate) setTripEndDate(settings.endDate);
      });
      return () => unsubscribe();
  }, []);

  const handleDateChange = (type: 'start' | 'end', date: string) => {
      if (type === 'start') {
          setTripStartDate(date);
          updateTripSettings({ startDate: date });
      } else {
          setTripEndDate(date);
          updateTripSettings({ endDate: date });
      }
  };

  const getDaysArray = () => {
      if (!tripStartDate || !tripEndDate) return [1, 2, 3, 4, 5]; 
      const start = new Date(tripStartDate);
      const end = new Date(tripEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const days = diffDays > 0 && diffDays < 30 ? diffDays : 1; 
      return Array.from({ length: days }, (_, i) => i + 1);
  };

  const getDayDate = (dayOffset: number): string => {
      if (!tripStartDate) return '';
      const date = new Date(tripStartDate);
      date.setDate(date.getDate() + (dayOffset - 1));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const daysList = getDaysArray();
  
  useEffect(() => {
     if (selectedDay > daysList.length) setSelectedDay(1);
  }, [daysList.length]);

  const dayItems = items
    .filter(i => i.day === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  const handleOpenEdit = (e: React.MouseEvent, item: ItineraryItem) => {
      e.stopPropagation();
      setEditingItemId(item.id);
      setNewItem({ ...item });
      setIsModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (newItem.activity && newItem.time && newItem.location) {
      setIsSaving(true);
      let coords = { lat: newItem.lat, lng: newItem.lng };
      if (!coords.lat || !coords.lng) {
          const fetched = await getCoordinatesForLocation(newItem.location);
          if (fetched) coords = fetched;
      }
      if (editingItemId) {
          await updateItineraryItem(editingItemId, {
             time: newItem.time,
             activity: newItem.activity,
             location: newItem.location,
             notes: newItem.notes || '',
             lat: coords.lat,
             lng: coords.lng
          });
      } else {
          await addItineraryItem({
            time: newItem.time!,
            activity: newItem.activity!,
            location: newItem.location,
            notes: newItem.notes || '',
            day: selectedDay,
            weather: { temp: 20, condition: 'sunny', icon: '☀️' },
            lat: coords.lat,
            lng: coords.lng
          });
      }
      setIsSaving(false);
      setIsModalOpen(false);
      setEditingItemId(null);
      setNewItem({ time: '09:00', day: selectedDay });
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const dateStr = getDayDate(selectedDay);
    const context = `Fun, Doodly, Creative trip. ${dateStr ? `Date: ${dateStr} (Predict weather for this specific date).` : ''}`;
    const suggestedItems = await generateItinerarySuggestion(selectedDay, context, targetAreas);
    for (const item of suggestedItems) await addItineraryItem(item);
    setIsGenerating(false);
    setIsPlanModalOpen(false);
  };

  const handleAppendAI = async () => {
      setIsAppending(true);
      const suggestion = await generateNextActivitySuggestion(dayItems);
      if (suggestion && suggestion.activity && suggestion.time && suggestion.location) {
          const coords = await getCoordinatesForLocation(suggestion.location);
          await addItineraryItem({
              time: suggestion.time,
              activity: suggestion.activity,
              location: suggestion.location,
              notes: suggestion.notes,
              day: selectedDay,
              lat: coords?.lat,
              lng: coords?.lng,
              weather: suggestion.weather
          });
      } else {
          alert("Couldn't think of anything nearby! Try adding manually.");
      }
      setIsAppending(false);
  };

  const getIcon = (idx: number) => {
      const icons = [ICON_PAGODA, ICON_LION, ICON_THUMB_BEAR, ICON_SQUARE_CAT];
      return icons[idx % icons.length];
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-[#FDFBF7] p-4">
      
      {/* Hand-drawn Title */}
      <div className="mb-6 text-center relative mt-2">
           <h2 className="text-4xl font-bold text-marker inline-block relative font-hand tracking-tight drop-shadow-sm">
              Seoul Trip Ideas
           </h2>
           <div className="absolute -top-3 -right-2 w-8 h-8 text-highlight animate-pulse" dangerouslySetInnerHTML={{__html: ICON_STAR}} />
      </div>

      {/* Date & Day Selection */}
      <div className="flex flex-col items-center mb-6 gap-4">
          <div className="bg-white border-2 border-ink rounded-full px-4 py-2 flex items-center gap-3 shadow-doodle-sm transform -rotate-1">
              <Calendar size={16} className="text-marker"/>
              <input 
                  type="date" 
                  value={tripStartDate}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className="outline-none text-ink font-bold font-sans text-xs bg-transparent w-24"
              />
              <ArrowRight size={14} className="text-ink"/>
              <input 
                  type="date" 
                  value={tripEndDate}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className="outline-none text-ink font-bold font-sans text-xs bg-transparent w-24"
              />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar w-full px-2 justify-start md:justify-center">
            {daysList.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex-shrink-0 w-12 h-12 flex flex-col items-center justify-center transition-all font-hand rounded-xl border-2 border-ink ${
                  selectedDay === day 
                    ? 'bg-marker text-white transform -translate-y-1 shadow-doodle-sm' 
                    : 'bg-white text-ink hover:bg-gray-50'
                }`}
              >
                <span className="font-bold text-lg leading-none">{day}</span>
              </button>
            ))}
          </div>
      </div>

      {/* Grid Layout - Cards mimicking the Second Image Style */}
      {/* 
         Style Rules applied:
         1. Yellow Background (cardbg)
         2. Wonky Borders
         3. White Inner Box for Image (border-ink)
         4. Text below
         5. Blue Button
      */}
      <div className="grid grid-cols-2 gap-4 pb-24">
        
        {/* Empty State */}
        {dayItems.length === 0 && (
            <div className="col-span-2 bg-cardbg border-2 border-ink rounded-[20px] p-6 text-center flex flex-col items-center shadow-doodle">
                <div className="w-32 h-32 mx-auto mb-4 p-4 bg-white border-2 border-ink rounded-xl" dangerouslySetInnerHTML={{__html: ICON_LION}}/>
                <p className="text-ink font-bold text-2xl mb-2 font-hand">Start Your Adventure!</p>
                <button onClick={() => setIsPlanModalOpen(true)} className="bg-ink text-white font-bold px-6 py-2 rounded-lg shadow-sm hover:bg-blue-800 transition-colors font-sans text-sm border-2 border-ink">
                    Generate Plan
                </button>
            </div>
        )}

        {dayItems.map((item, idx) => (
          <div 
            key={item.id} 
            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
            className={`
                col-span-1 bg-cardbg border-2 border-ink p-3 flex flex-col relative group cursor-pointer shadow-doodle-sm transition-transform hover:-translate-y-1
                wonky-box
                ${expandedId === item.id ? 'row-span-2 z-20 ring-4 ring-highlight' : ''}
            `}
            style={{ minHeight: '260px' }}
          >
             {/* Edit Button */}
             <button 
                onClick={(e) => handleOpenEdit(e, item)}
                className="absolute top-2 right-2 p-1 bg-white border-2 border-ink rounded-full text-ink hover:text-marker z-10"
            >
                <Edit2 size={10}/>
            </button>

            {/* 1. Illustration Area - White Box with Blue Border */}
            <div className="bg-white border-2 border-ink rounded-xl h-32 w-full mb-3 flex items-center justify-center relative overflow-hidden">
                {/* Random background dots inside image box */}
                <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'url(#blue-dots)'}}></div>
                
                <div className="w-24 h-24 transform transition-transform group-hover:scale-110 duration-300 relative z-10" 
                     dangerouslySetInnerHTML={{__html: getIcon(idx)}} 
                />
            </div>

            {/* 2. Content Area */}
            <div className="flex-1 flex flex-col justify-between px-1">
                <div>
                    {/* Activity Name */}
                    <h3 className="text-ink font-bold text-lg leading-tight mb-1 font-hand line-clamp-2">
                        {item.activity}
                    </h3>
                    {/* Description/Location */}
                    <p className="text-[10px] text-gray-500 font-bold font-sans line-clamp-2 mb-2">
                        {item.location}
                    </p>
                </div>

                {/* 3. Footer: Time & Button */}
                <div className="flex justify-between items-center mt-auto">
                     <span className="text-xs font-bold text-ink bg-white px-1.5 py-0.5 border border-ink rounded">
                        {item.time}
                     </span>
                     
                     <button className="bg-ink text-white text-[10px] font-bold px-2 py-1.5 rounded border border-ink shadow-sm hover:bg-blue-800 font-sans">
                        View Details
                    </button>
                </div>
            </div>

            {/* Decoration Sparkle */}
            <div className="absolute -bottom-2 -right-2 w-6 h-6 animate-pulse z-0 pointer-events-none" dangerouslySetInnerHTML={{__html: ICON_SPARKLE}} />

            {/* Expanded Overlay */}
            {expandedId === item.id && (
                <div className="absolute inset-0 bg-cardbg rounded-[inherit] p-4 flex flex-col z-30 text-left border-0">
                     <div className="flex justify-between items-center mb-2 border-b-2 border-ink pb-1 border-dashed">
                        <span className="text-ink font-bold font-hand text-xl">Details</span>
                        <button onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}>
                            <ChevronUp className="text-ink"/>
                        </button>
                     </div>
                     <div className="flex-1 overflow-y-auto text-sm font-bold text-ink space-y-2 font-sans bg-white border-2 border-ink rounded-lg p-2 mb-2">
                        <p>{item.notes || "No notes."}</p>
                        {item.weather && (
                            <p className="text-xs text-gray-500 flex items-center gap-1 border-t border-gray-200 pt-1 mt-1">
                                <span>{item.weather.icon}</span> 
                                {item.weather.temp}°C, {item.weather.condition}
                            </p>
                        )}
                     </div>
                     <div className="flex gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); window.open(`https://map.naver.com/v5/search/${item.location}`, '_blank'); }}
                            className="flex-1 bg-marker text-white text-xs font-bold py-2 rounded border-2 border-ink hover:bg-red-600 font-sans"
                        >
                            Map
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); deleteItineraryItem(item.id); }}
                            className="bg-white text-ink p-2 rounded border-2 border-ink hover:bg-gray-100"
                        >
                            <Trash2 size={16}/>
                        </button>
                     </div>
                </div>
            )}
          </div>
        ))}

        {/* AI Append Button */}
        {dayItems.length > 0 && (
            <div className="col-span-2 mt-2">
                <button 
                    onClick={handleAppendAI}
                    disabled={isAppending}
                    className="w-full bg-white border-2 border-ink border-dashed rounded-xl p-3 flex items-center justify-center gap-2 text-ink font-bold hover:bg-blue-50 transition-colors"
                >
                    {isAppending ? <Loader2 className="animate-spin" size={20}/> : <Sparkles className="text-marker" size={20}/>}
                    {isAppending ? "Thinking..." : "AI Suggest Next Activity"}
                </button>
            </div>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => {
            setEditingItemId(null);
            setNewItem({ time: '09:00', day: selectedDay });
            setIsModalOpen(true);
        }}
        className="fixed bottom-24 right-6 w-14 h-14 bg-ink text-white rounded-full border-2 border-white shadow-doodle flex items-center justify-center hover:scale-110 transition-transform z-40"
      >
        <Plus size={30} strokeWidth={3} />
      </button>

      {/* Modal: Add / Edit Item */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-ink rounded-[20px] p-6 w-full max-w-sm shadow-doodle relative">
            <h2 className="text-3xl font-bold text-ink mb-6 text-center font-hand transform -rotate-2">{editingItemId ? 'Edit Plan' : 'New Plan'}</h2>
            <div className="space-y-4">
               <div className="flex items-center gap-2">
                   <div className="w-1/3">
                       <label className="block text-xs font-bold text-ink mb-1">Time</label>
                       <input 
                         type="time" 
                         value={newItem.time} 
                         onChange={e => setNewItem({...newItem, time: e.target.value})}
                         className="w-full hand-input text-center text-lg font-bold"
                       />
                   </div>
                   <div className="w-2/3">
                        <label className="block text-xs font-bold text-ink mb-1">Activity</label>
                        <input 
                            placeholder="e.g. Lunch" 
                            value={newItem.activity} 
                            onChange={e => setNewItem({...newItem, activity: e.target.value})}
                            className="w-full hand-input font-bold"
                        />
                   </div>
               </div>
               
               <div>
                   <label className="block text-xs font-bold text-ink mb-1">Where?</label>
                   <input 
                     placeholder="Location name" 
                     value={newItem.location} 
                     onChange={e => setNewItem({...newItem, location: e.target.value})}
                     className="w-full hand-input font-bold"
                   />
               </div>

               <div>
                   <label className="block text-xs font-bold text-ink mb-1">Notes</label>
                   <textarea 
                     placeholder="Details..." 
                     value={newItem.notes} 
                     onChange={e => setNewItem({...newItem, notes: e.target.value})}
                     className="w-full hand-input h-20 font-bold"
                   />
               </div>
            </div>
            <div className="flex gap-3 mt-6">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white text-ink border-2 border-ink font-bold py-3 rounded-xl hover:bg-gray-100">Cancel</button>
                <button onClick={handleSaveItem} disabled={isSaving} className="flex-1 bg-marker text-white border-2 border-ink font-bold py-3 rounded-xl shadow-sm hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2">
                    {isSaving && <Loader2 className="animate-spin" size={16}/>}
                    Save
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: AI Plan */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-ink rounded-[20px] p-6 w-full max-w-sm shadow-doodle relative">
             <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-white rounded-full border-2 border-ink flex items-center justify-center z-10 shadow-sm">
                 <Wand2 className="text-marker" size={32}/>
             </div>
             <h2 className="text-3xl font-bold text-ink mt-6 text-center mb-2 font-hand">AI Planner</h2>
             <p className="text-center text-gray-500 text-sm font-bold mb-4 font-sans">Enter the places you want to visit today:</p>
             <textarea 
                 value={targetAreas}
                 onChange={e => setTargetAreas(e.target.value)}
                 placeholder="e.g. Gyeongbokgung, Bukchon Hanok Village, Onion Cafe, Insadong..."
                 className="w-full h-32 hand-input mb-4 font-bold"
             />
             <p className="text-[10px] text-gray-400 font-bold mb-2 text-center">AI will sort them and fill in the gaps!</p>
             <button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="w-full bg-ink text-white border-2 border-ink font-bold py-3 rounded-xl shadow-sm flex justify-center gap-2 font-sans"
             >
                {isGenerating ? <Loader2 className="animate-spin"/> : <Sparkles/>}
                {isGenerating ? "Building Schedule..." : "Plan My Day"}
             </button>
             <button onClick={() => setIsPlanModalOpen(false)} className="w-full text-center mt-3 text-ink font-bold underline text-sm font-sans">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItineraryView;
