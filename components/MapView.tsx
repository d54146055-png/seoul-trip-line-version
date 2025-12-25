
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X, Search, Map as MapIcon, Crosshair, Sparkles, ArrowRight, TrainFront, Bus, Footprints, Loader2, Plus, Calendar, List, Eye, EyeOff } from 'lucide-react';
import { parseLocationsFromText, calculateRoute, RouteOption } from '../services/geminiService';
import { ItineraryItem, MapMarker } from '../types';
import { subscribeToMarkers, addMapMarker, clearAllMarkers } from '../services/firebaseService';

// Use L as a global variable from the script tag in index.html
declare const L: any;

interface Props {
  itineraryItems?: ItineraryItem[];
}

// Color palette for different days
const DAY_COLORS: Record<number, string> = {
  1: 'bg-blue-500',
  2: 'bg-red-500',
  3: 'bg-green-600',
  4: 'bg-purple-500',
  5: 'bg-amber-500',
  6: 'bg-pink-500',
  7: 'bg-indigo-600',
};

const MapView: React.FC<Props> = ({ itineraryItems = [] }) => {
  const [singleInput, setSingleInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [locations, setLocations] = useState<MapMarker[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [showLocationsList, setShowLocationsList] = useState(false);
  
  // List UI State
  const [listSelectedDay, setListSelectedDay] = useState<number | 'search'>(1);
  const [hiddenDays, setHiddenDays] = useState<Set<number | 'search'>>(new Set());

  // Routing State
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [routeStart, setRouteStart] = useState<string>('');
  const [routeEnd, setRouteEnd] = useState<string>('');
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: [37.5665, 126.9780],
      zoom: 13
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(mapRef.current);

    setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Subscribe to persistent markers
  useEffect(() => {
    const unsubscribe = subscribeToMarkers(setLocations);
    return () => unsubscribe();
  }, []);

  // Sync Locations to Markers on Map (Filtered by Visibility)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old markers from the map view
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Filter locations based on visibility toggle
    const visibleLocations = locations.filter(loc => {
        if (loc.type === 'search') return !hiddenDays.has('search');
        if (loc.type === 'itinerary' && loc.day) return !hiddenDays.has(loc.day);
        return true;
    });

    if (visibleLocations.length === 0) return;

    const bounds = L.latLngBounds([]);

    visibleLocations.forEach((loc) => {
      const bgColor = loc.type === 'itinerary' && loc.day 
        ? (DAY_COLORS[loc.day] || 'bg-cocoa') 
        : 'bg-accent';

      const iconSvg = loc.type === 'itinerary' ? 
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>` :
        `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

      const markerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="flex flex-col items-center">
            <div class="w-10 h-10 ${bgColor} text-white rounded-full border-4 border-white shadow-xl flex items-center justify-center animate-bounce">
              ${iconSvg}
            </div>
            <div class="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm mt-1 border border-sand">
               <span class="text-[10px] font-bold text-cocoa whitespace-nowrap">${loc.type === 'itinerary' && loc.day ? 'D' + loc.day + ' ' : ''}${loc.name}</span>
            </div>
          </div>
        `,
        iconSize: [40, 60],
        iconAnchor: [20, 50]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: markerIcon }).addTo(mapRef.current);
      
      const popupContent = document.createElement('div');
      popupContent.className = 'p-3 text-cocoa text-center';
      popupContent.innerHTML = `
        <div class="mb-2">
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${bgColor}">
                ${loc.type === 'itinerary' ? 'DAY ' + loc.day + ' 行程' : '搜尋結果'}
            </span>
        </div>
        <h4 class="font-bold text-base mb-1">${loc.name}</h4>
        <p class="text-xs text-gray-500 mb-4 leading-snug">${loc.description || '首爾旅遊地點'}</p>
        <div class="flex flex-col gap-2">
           <div class="flex gap-2">
              <button id="set-start-${loc.id}" class="flex-1 bg-cream text-cocoa border border-sand text-[10px] font-bold py-2 rounded-lg">設為起點</button>
              <button id="set-end-${loc.id}" class="flex-1 bg-cream text-cocoa border border-sand text-[10px] font-bold py-2 rounded-lg">設為終點</button>
           </div>
           <button id="naver-${loc.id}" class="w-full bg-cocoa text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all">
             <img src="https://map.naver.com/v5/assets/img/favicon/favicon-32x32.png" width="16" class="rounded-sm" />
             Naver Map 導航
           </button>
        </div>
      `;

      marker.bindPopup(popupContent, { minWidth: 180 });
      
      marker.on('popupopen', () => {
        const btnNaver = document.getElementById(`naver-${loc.id}`);
        if (btnNaver) btnNaver.onclick = () => openNaverMap(loc.name);
        
        const btnStart = document.getElementById(`set-start-${loc.id}`);
        if (btnStart) btnStart.onclick = () => { setRouteStart(loc.name); setShowRoutePanel(true); marker.closePopup(); };
        
        const btnEnd = document.getElementById(`set-end-${loc.id}`);
        if (btnEnd) btnEnd.onclick = () => { setRouteEnd(loc.name); setShowRoutePanel(true); marker.closePopup(); };
      });

      markersRef.current.push(marker);
      bounds.extend([loc.lat, loc.lng]);
    });

    if (visibleLocations.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
    }
  }, [locations, hiddenDays]);

  const toggleDayVisibility = (day: number | 'search') => {
      setHiddenDays(prev => {
          const next = new Set(prev);
          if (next.has(day)) next.delete(day);
          else next.add(day);
          return next;
      });
  };

  const handleSingleAdd = async () => {
    if (!singleInput.trim()) return;
    setIsProcessing(true);
    const results = await parseLocationsFromText(singleInput);
    if (results.length > 0) {
      for (const r of results) {
        await addMapMarker({
          ...r,
          type: 'search',
          timestamp: Date.now()
        });
      }
      setSingleInput('');
    }
    setIsProcessing(false);
  };

  const handleImportItinerary = async () => {
    if (!itineraryItems || itineraryItems.length === 0) {
      alert("目前沒有任何行程可以匯入。");
      return;
    }

    setIsProcessing(true);
    const placesToGeocode = itineraryItems.map(item => `${item.location} (${item.activity})`).join('\n');
    const geocodedResults = await parseLocationsFromText(`匯入行程地點座標：\n${placesToGeocode}`);

    if (geocodedResults.length > 0) {
      for (let i = 0; i < geocodedResults.length; i++) {
        const r = geocodedResults[i];
        const original = itineraryItems[i] || {};
        await addMapMarker({
          ...r,
          type: 'itinerary',
          time: original.time,
          day: original.day,
          timestamp: Date.now()
        });
      }
      setShowLocationsList(true);
    }
    setIsProcessing(false);
  };

  const handleBulkProcess = async () => {
    if (!bulkInput.trim()) return;
    setIsProcessing(true);
    const results = await parseLocationsFromText(bulkInput);
    for (const r of results) {
      await addMapMarker({
        ...r,
        type: 'search',
        timestamp: Date.now()
      });
    }
    setIsProcessing(false);
    setShowBulkInput(false);
    setBulkInput('');
  };

  const handleCalculateRoute = async () => {
    if (!routeStart || !routeEnd) return;
    setIsCalculatingRoute(true);
    
    const options = await calculateRoute(routeStart, routeEnd);
    setRouteOptions(options);
    
    if (mapRef.current) {
        const startLoc = locations.find(l => l.name === routeStart);
        const endLoc = locations.find(l => l.name === routeEnd);
        
        if (polylineRef.current) polylineRef.current.remove();
        
        if (startLoc && endLoc) {
            polylineRef.current = L.polyline([[startLoc.lat, startLoc.lng], [endLoc.lat, endLoc.lng]], {
                color: '#FF7043',
                weight: 4,
                opacity: 0.6,
                dashArray: '10, 10'
            }).addTo(mapRef.current);
            mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [100, 100] });
        }
    }
    setIsCalculatingRoute(false);
  };

  const openNaverMap = (name: string) => {
    const query = encodeURIComponent(`${name} 首爾`);
    const url = `https://map.naver.com/v5/search/${query}`;
    window.open(url, '_blank');
  };

  const openNaverRoute = (mode: string) => {
    const url = `https://map.naver.com/v5/directions/${encodeURIComponent(routeStart)}/${encodeURIComponent(routeEnd)}/-/transit`;
    window.open(url, '_blank');
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
        alert("瀏覽器不支援定位功能");
        return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapRef.current) {
            mapRef.current.setView([latitude, longitude], 16);
            if (userMarkerRef.current) userMarkerRef.current.remove();
            const userIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon }).addTo(mapRef.current);
        }
    });
  };

  const focusLocation = (loc: MapMarker) => {
    if (mapRef.current) {
      mapRef.current.setView([loc.lat, loc.lng], 16);
      const targetMarker = markersRef.current.find(m => {
        const latlng = m.getLatLng();
        return Math.abs(latlng.lat - loc.lat) < 0.00001 && Math.abs(latlng.lng - loc.lng) < 0.00001;
      });
      if (targetMarker) targetMarker.openPopup();
      setShowLocationsList(false);
    }
  };

  const handleClearMarkers = async () => {
    if (confirm("確定要清空地圖上的所有標記嗎？")) {
      await clearAllMarkers();
    }
  };

  const filteredListLocations = locations.filter(loc => {
      if (listSelectedDay === 'search') return loc.type === 'search';
      return loc.type === 'itinerary' && loc.day === listSelectedDay;
  });

  return (
    <div className="h-full w-full relative flex flex-col overflow-hidden">
      {/* Background Map */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-cream" style={{ minHeight: '100%' }} />

      {/* Top Search Bar */}
      <div className="relative z-20 p-4 pointer-events-none w-full">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-sand p-2 flex items-center gap-2">
            <div className="pl-3 text-latte">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-cocoa placeholder-latte/60"
              placeholder="搜尋地點並標記..."
              value={singleInput}
              onChange={(e) => setSingleInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSingleAdd()}
            />
            <button 
              onClick={handleSingleAdd}
              disabled={isProcessing || !singleInput.trim()}
              className="bg-cocoa text-white p-2 rounded-xl active:scale-95 transition-all disabled:opacity-50"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Action Buttons (Right) */}
      <div className="absolute top-24 right-4 z-20 flex flex-col gap-3 pointer-events-none">
        <button 
          onClick={handleImportItinerary}
          disabled={isProcessing}
          className="pointer-events-auto w-12 h-12 bg-cocoa text-white rounded-2xl shadow-xl border border-cocoa flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
          title="匯入行程"
        >
          {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Calendar size={22} />}
        </button>

        <button 
          onClick={() => setShowLocationsList(!showLocationsList)}
          className={`pointer-events-auto w-12 h-12 rounded-2xl shadow-xl border border-sand flex items-center justify-center transition-all active:scale-95 relative ${showLocationsList ? 'bg-latte text-white' : 'bg-white/90 text-cocoa'}`}
          title="標記清單"
        >
          <List size={22} />
          {locations.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {locations.length}
            </span>
          )}
        </button>

        <button 
          onClick={() => setShowRoutePanel(!showRoutePanel)}
          className={`pointer-events-auto w-12 h-12 rounded-2xl shadow-xl border border-sand flex items-center justify-center transition-all active:scale-95 ${showRoutePanel ? 'bg-accent text-white' : 'bg-white/90 text-cocoa'}`}
          title="路徑規劃"
        >
          <Navigation size={22} />
        </button>
        
        <button 
          onClick={() => setShowBulkInput(true)}
          className="pointer-events-auto w-12 h-12 bg-white/90 rounded-2xl shadow-xl border border-sand flex items-center justify-center text-cocoa active:scale-95 transition-all"
          title="AI 批次匯入"
        >
          <Sparkles size={22} className="text-accent" />
        </button>
        <button 
          onClick={locateMe}
          className="pointer-events-auto w-12 h-12 bg-white/90 rounded-2xl shadow-xl border border-sand flex items-center justify-center text-cocoa active:scale-95 transition-all"
          title="我的位置"
        >
          <Crosshair size={22} />
        </button>
      </div>

      {/* Locations List Modal - Refactored for Tabs & Toggle */}
      {showLocationsList && (
        <div className="absolute inset-x-4 bottom-24 z-30 max-w-sm mx-auto pointer-events-none">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl p-6 pointer-events-auto border border-sand w-full animate-[slideUp_0.3s]">
            
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-cocoa flex items-center gap-2"><MapPin size={16} /> 標記地點清單</h4>
              <div className="flex items-center gap-3">
                 <button onClick={handleClearMarkers} className="text-[10px] font-bold text-accent px-2 py-1 bg-accent/10 rounded-lg">清空地圖</button>
                 <button onClick={() => setShowLocationsList(false)}><X size={18} className="text-gray-400"/></button>
              </div>
            </div>

            {/* Day Selector (Tabs) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 mb-2">
                {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <div key={`tab-${d}`} className="flex flex-col items-center gap-1">
                        <button
                            onClick={() => setListSelectedDay(d)}
                            className={`min-w-[3.5rem] h-10 rounded-xl font-bold text-xs transition-all flex flex-col items-center justify-center relative ${
                                listSelectedDay === d ? 'bg-cocoa text-white' : 'bg-cream text-latte'
                            }`}
                        >
                            <span className="text-[8px] opacity-60">DAY</span>
                            <span>{d}</span>
                            {/* Visibility Dot */}
                            {!hiddenDays.has(d) && <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${DAY_COLORS[d]}`}></div>}
                        </button>
                        <button 
                            onClick={() => toggleDayVisibility(d)}
                            className={`p-1.5 rounded-lg transition-colors ${hiddenDays.has(d) ? 'text-gray-300 hover:text-cocoa' : 'text-cocoa bg-cream'}`}
                        >
                            {hiddenDays.has(d) ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                ))}
                <div className="flex flex-col items-center gap-1">
                    <button
                        onClick={() => setListSelectedDay('search')}
                        className={`min-w-[3.5rem] h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center relative ${
                            listSelectedDay === 'search' ? 'bg-accent text-white' : 'bg-cream text-latte'
                        }`}
                    >
                        手動
                        {!hiddenDays.has('search') && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white bg-accent"></div>}
                    </button>
                    <button 
                        onClick={() => toggleDayVisibility('search')}
                        className={`p-1.5 rounded-lg transition-colors ${hiddenDays.has('search') ? 'text-gray-300 hover:text-accent' : 'text-accent bg-accent/5'}`}
                    >
                        {hiddenDays.has('search') ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                </div>
            </div>
            
            <div className="max-h-56 overflow-y-auto no-scrollbar space-y-2 mt-2">
               {filteredListLocations.length === 0 ? (
                 <div className="py-10 text-center">
                   <p className="text-xs text-gray-400">本類別目前無標記</p>
                 </div>
               ) : (
                 filteredListLocations.map((loc) => (
                   <div key={loc.id} onClick={() => focusLocation(loc)} className="bg-cream/50 p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-cream transition-all group">
                     <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full ${loc.type === 'search' ? 'bg-accent' : (DAY_COLORS[loc.day!] || 'bg-cocoa')}`}></div>
                        <p className="text-xs font-bold text-cocoa truncate">
                            {loc.type === 'itinerary' && loc.time ? <span className="text-latte mr-1">[{loc.time}]</span> : null}
                            {loc.name}
                        </p>
                     </div>
                     <Navigation size={12} className="text-latte opacity-0 group-hover:opacity-100 transition-opacity" />
                   </div>
                 ))
               )}
            </div>
            {hiddenDays.has(listSelectedDay) && filteredListLocations.length > 0 && (
                <div className="mt-4 p-2 bg-accent/5 rounded-xl flex items-center gap-2">
                    <EyeOff size={14} className="text-accent"/>
                    <p className="text-[10px] text-accent font-bold">目前地圖已隱藏此天數的標記，清單仍可查看。</p>
                </div>
            )}
          </div>
        </div>
      )}

      {/* Route Planning Panel Overlay */}
      {showRoutePanel && (
        <div className="absolute inset-x-4 top-24 z-30 max-w-sm mx-auto pointer-events-none">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl p-6 pointer-events-auto border border-sand w-full animate-[slideDown_0.3s]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-cocoa flex items-center gap-2"><Navigation size={16} /> 首爾路徑規劃</h4>
              <button onClick={() => setShowRoutePanel(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="relative">
                <div className="absolute left-3 top-3.5 w-2 h-2 rounded-full border-2 border-latte"></div>
                <input 
                  placeholder="起點 (例如: 景福宮)" 
                  className="w-full pl-9 pr-4 py-3 bg-cream/50 rounded-xl text-sm text-cocoa focus:outline-none border-b border-sand"
                  value={routeStart}
                  onChange={(e) => setRouteStart(e.target.value)}
                />
              </div>
              <div className="relative">
                <div className="absolute left-3 top-3.5 w-2 h-2 bg-accent rounded-sm"></div>
                <input 
                  placeholder="終點 (例如: 弘大)" 
                  className="w-full pl-9 pr-4 py-3 bg-cream/50 rounded-xl text-sm text-cocoa focus:outline-none"
                  value={routeEnd}
                  onChange={(e) => setRouteEnd(e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={handleCalculateRoute}
              disabled={isCalculatingRoute || !routeStart || !routeEnd}
              className="w-full bg-cocoa text-white py-3 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCalculatingRoute ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} className="text-accent"/>}
              <span>AI 估算交通時間</span>
            </button>

            {routeOptions.length > 0 && (
              <div className="mt-5 space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                <p className="text-[10px] font-bold text-latte uppercase tracking-widest px-1">交通工具建議</p>
                {routeOptions.map((opt, i) => (
                  <div 
                    key={i} 
                    onClick={() => openNaverRoute(opt.type)}
                    className="bg-cream/30 hover:bg-cream/70 p-3 rounded-xl border border-sand/30 flex items-center justify-between cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm text-cocoa">
                        {opt.type === 'subway' && <TrainFront size={16} />}
                        {opt.type === 'bus' && <Bus size={16} />}
                        {opt.type === 'walk' && <Footprints size={16} />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-cocoa">{opt.summary}</p>
                        <p className="text-[10px] text-latte">預計 {opt.duration}</p>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-sand group-hover:text-accent transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Bulk Import Overlay */}
      {showBulkInput && (
        <div className="fixed inset-0 z-50 bg-cocoa/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-6 shadow-2xl animate-[float_0.3s_ease-out]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-cocoa flex items-center gap-2"><Sparkles size={18} className="text-accent"/> AI 批次景點標記</h3>
              <button onClick={() => setShowBulkInput(false)} className="text-gray-400 hover:text-cocoa"><X size={20}/></button>
            </div>
            <textarea
              className="w-full h-40 p-4 bg-cream rounded-2xl border-none focus:ring-2 focus:ring-cocoa text-sm mb-4 resize-none text-cocoa"
              placeholder="貼上長篇行程文字..."
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
            />
            <button onClick={handleBulkProcess} className="w-full bg-cocoa text-white py-4 rounded-2xl font-bold text-sm">標記所有地點</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
