
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X, Search, List, Crosshair, Trash2, Calendar, ArrowRight, TrainFront, Bus, Footprints, Loader2, Plus, Sparkles, Layers, Eye, EyeOff } from 'lucide-react';
import { parseLocationsFromText, calculateRoute, RouteOption, getCoordinatesForLocation } from '../services/geminiService';
import { ItineraryItem, MapMarker } from '../types';
import { subscribeToMarkers, addMapMarker, clearAllMarkers, updateItineraryItem } from '../services/firebaseService';
import { ICON_SQUARE_CAT } from '../utils/icons';

declare const L: any;

interface Props { itineraryItems?: ItineraryItem[]; }

const DAY_COLORS = [
    '#D93025', // Day 1 Red
    '#1A73E8', // Day 2 Blue
    '#188038', // Day 3 Green
    '#A142F4', // Day 4 Purple
    '#F9AB00', // Day 5 Orange
    '#004AAD', // Default Ink
];

const MapView: React.FC<Props> = ({ itineraryItems = [] }) => {
  const [singleInput, setSingleInput] = useState('');
  const [locations, setLocations] = useState<MapMarker[]>([]);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  
  // Itinerary Panel State
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState(1);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const [routeStart, setRouteStart] = useState('');
  const [routeEnd, setRouteEnd] = useState('');
  const [routeResults, setRouteResults] = useState<RouteOption[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);

  // Init Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false, center: [37.5665, 126.9780], zoom: 13 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 200);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Sync Markers
  useEffect(() => {
    const unsubscribe = subscribeToMarkers(setLocations);
    return () => unsubscribe();
  }, []);

  // Update Markers on Map (General Locations)
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    locations.forEach((loc) => {
      const isItinerary = loc.type === 'itinerary';
      const dayIndex = (loc.day || 1) - 1;
      const color = isItinerary ? DAY_COLORS[dayIndex % DAY_COLORS.length] : '#FF4500'; // Default Orange for search
      
      // Pin Icon SVG - Hand drawn style pin
      const pinSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3" fill="white"></circle>
        </svg>
      `;

      const markerIcon = L.divIcon({
        className: 'custom-pin-icon',
        html: `
          <div class="relative w-10 h-10 transform -translate-x-1/2 -translate-y-full hover:scale-110 transition-transform group cursor-pointer drop-shadow-md">
            ${pinSvg}
            ${isItinerary && loc.day ? `<span class="absolute -top-2 -right-2 bg-white text-ink text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-ink transform rotate-6 shadow-sm">D${loc.day}</span>` : ''}
          </div>
        `,
        iconSize: [40, 40], iconAnchor: [20, 40]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: markerIcon }).addTo(mapRef.current);
      
      // Doodle Popup
      const popupContent = `
        <div class="text-center font-sans p-2">
            <div class="font-bold text-lg text-ink font-hand" style="color:${color}">${loc.name}</div>
            <div class="text-xs text-gray-500 font-bold mb-2">${loc.day ? `Day ${loc.day} • ` : ''}${loc.description || (isItinerary ? 'Itinerary Item' : 'Marked Place')}</div>
            <div class="flex gap-2 justify-center">
                <button onclick="window.dispatchEvent(new CustomEvent('setRouteStart', {detail: '${loc.name}'}))" class="bg-white border-2 border-ink text-ink text-[10px] font-bold px-2 py-1 rounded hover:bg-gray-100">Start</button>
                <button onclick="window.dispatchEvent(new CustomEvent('setRouteEnd', {detail: '${loc.name}'}))" class="bg-white border-2 border-ink text-ink text-[10px] font-bold px-2 py-1 rounded hover:bg-gray-100">End</button>
            </div>
        </div>
      `;
      marker.bindPopup(popupContent, { minWidth: 150 });
      markersRef.current.push(marker);
    });
  }, [locations]); 

  // User Location Marker (Square Cat)
  useEffect(() => {
      if (!mapRef.current || !userLocation) return;
      if (userMarkerRef.current) userMarkerRef.current.remove();

      const catIcon = L.divIcon({
          className: 'user-cat-icon',
          html: `
            <div class="relative w-12 h-12 transform -translate-x-1/2 -translate-y-1/2 drop-shadow-lg animate-pulse">
               ${ICON_SQUARE_CAT}
               <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-2 bg-black/20 rounded-full blur-[2px]"></div>
            </div>
          `,
          iconSize: [48, 48], iconAnchor: [24, 24]
      });

      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: catIcon, zIndexOffset: 1000 }).addTo(mapRef.current);
      userMarkerRef.current.bindPopup(`<div class="font-hand font-bold text-center">Meow! (You are here)</div>`);

  }, [userLocation]);

  // Event Listeners for Popup Buttons
  useEffect(() => {
    const handleStart = (e: any) => { setRouteStart(e.detail); setShowRoutePanel(true); };
    const handleEnd = (e: any) => { setRouteEnd(e.detail); setShowRoutePanel(true); };
    window.addEventListener('setRouteStart', handleStart);
    window.addEventListener('setRouteEnd', handleEnd);
    return () => {
        window.removeEventListener('setRouteStart', handleStart);
        window.removeEventListener('setRouteEnd', handleEnd);
    };
  }, []);

  const handleLocateMe = () => {
     if (navigator.geolocation) {
         navigator.geolocation.getCurrentPosition(pos => {
             const { latitude, longitude } = pos.coords;
             setUserLocation({ lat: latitude, lng: longitude });
             if (mapRef.current) mapRef.current.setView([latitude, longitude], 15);
         });
     } else {
         alert("Geolocation not supported");
     }
  };

  // 1. Manual Add
  const handleAdd = async () => {
    if (!singleInput.trim()) return;
    const results = await parseLocationsFromText(singleInput);
    if (results.length > 0) {
        results.forEach(r => addMapMarker({ ...r, type: 'search', timestamp: Date.now() }));
        if (mapRef.current) mapRef.current.setView([results[0].lat, results[0].lng], 14);
        setSingleInput('');
    } else {
        alert("Couldn't find that place. Try a different name!");
    }
  };

  // 2. Import Itinerary (Revised Logic - Robust)
  const handleImportItinerary = async () => {
    if (itineraryItems.length === 0) {
        alert("Your itinerary is empty! Go to Plan tab first.");
        return;
    }
    
    if(confirm(`Import ${itineraryItems.length} items from your plan to the map? (This might take a moment to find coordinates)`)) {
        setIsImporting(true);
        let successCount = 0;
        let failedCount = 0;
        
        try {
            // Process every item
            for (const item of itineraryItems) {
                // Check if already mapped (based on name and day)
                // Note: locations might be from search, so we check if an itinerary item of this name/day exists.
                const exists = locations.some(l => l.type === 'itinerary' && l.day === item.day && l.name === item.activity);
                if (exists) continue;

                let lat = item.lat;
                let lng = item.lng;

                // If no coords, fetch them individually now
                if (!lat || !lng) {
                    // Only try to fetch if we have a valid location or activity string
                    const query = item.location || item.activity;
                    if (query && query.length > 2) {
                        const coords = await getCoordinatesForLocation(query);
                        if (coords) {
                            lat = coords.lat;
                            lng = coords.lng;
                            // IMPORTANT: Save back to itinerary so we don't fetch again next time
                            // We do this in background to avoid blocking too much, but need to await to ensure consistency for map add
                            await updateItineraryItem(item.id, { lat, lng });
                        }
                    }
                }

                if (lat && lng) {
                    await addMapMarker({
                         name: item.activity,
                         description: item.location || '',
                         lat: lat,
                         lng: lng,
                         type: 'itinerary',
                         day: item.day,
                         time: item.time,
                         timestamp: Date.now()
                    });
                    successCount++;
                } else {
                    failedCount++;
                }
            }
            
            if (successCount > 0) {
                alert(`Imported ${successCount} locations! Opening schedule.`);
                setShowSchedulePanel(true);
            } else if (failedCount > 0) {
                alert(`Could not locate ${failedCount} items (likely missing specific location names). Try editing them in the Plan tab.`);
            } else {
                alert("No new items to import.");
            }
        } catch (e) {
            alert("Error importing. Please try again.");
            console.error(e);
        } finally {
            setIsImporting(false);
        }
    }
  };

  // 3. Route Calculation
  const handleCalculateRoute = async () => {
    if(!routeStart || !routeEnd) return;
    setIsCalculating(true);
    setRouteResults([]);
    const results = await calculateRoute(routeStart, routeEnd);
    setRouteResults(results);
    setIsCalculating(false);
  };

  const getDayMarkers = (day: number) => {
      return locations.filter(l => l.day === day && l.type === 'itinerary').sort((a,b) => (a.time || '').localeCompare(b.time || ''));
  };

  const flyToLocation = (lat: number, lng: number) => {
      if(mapRef.current) {
          mapRef.current.setView([lat, lng], 16, { animate: true });
      }
  };

  return (
    <div className="h-full w-full relative flex flex-col">
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-paper" />

      {/* Top Search Bar */}
      <div className="relative z-20 p-4 pointer-events-none">
        <div className="bg-white hand-border p-2 flex items-center shadow-doodle pointer-events-auto">
            <input 
              className="flex-1 bg-transparent outline-none text-ink font-bold placeholder-gray-400 font-sans"
              placeholder="Mark a place (e.g. N Seoul Tower)..."
              value={singleInput}
              onChange={e => setSingleInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button onClick={handleAdd} className="bg-marker text-white p-2 rounded-full hover:rotate-12 transition-transform shadow-sm border-2 border-transparent">
                <Plus size={18}/>
            </button>
        </div>
      </div>

      {/* Side Controls */}
      <div className="absolute top-24 right-4 z-20 flex flex-col gap-3 pointer-events-none">
         {/* Import Itinerary Button */}
         <button 
             onClick={handleImportItinerary} 
             disabled={isImporting}
             className="pointer-events-auto bg-highlight hand-border w-14 h-14 flex items-center justify-center shadow-doodle text-ink hover:scale-105 transition-transform bg-white" 
             title="Import Itinerary"
         >
             {isImporting ? <Loader2 size={24} className="animate-spin"/> : <Calendar size={24}/>}
         </button>
         
         {/* Schedule/Layers Toggle Button */}
         <button onClick={() => setShowSchedulePanel(!showSchedulePanel)} className={`pointer-events-auto hand-border w-14 h-14 flex items-center justify-center shadow-doodle transition-transform ${showSchedulePanel ? 'bg-ink text-white' : 'bg-white text-ink'}`} title="Schedule">
             <List size={24}/>
         </button>

         {/* Route Panel Toggle */}
         <button onClick={() => setShowRoutePanel(!showRoutePanel)} className={`pointer-events-auto hand-border w-14 h-14 flex items-center justify-center shadow-doodle transition-transform ${showRoutePanel ? 'bg-ink text-white' : 'bg-white text-ink'}`} title="Route Planner">
             <Navigation size={24}/>
         </button>
         
         <div className="h-4"/> {/* Spacer */}

         {/* Standard Map Controls */}
         <button onClick={handleLocateMe} className="pointer-events-auto bg-marker hand-border w-14 h-14 flex items-center justify-center shadow-doodle text-white hover:scale-105">
             <Crosshair size={28}/>
         </button>

         <button onClick={() => { if(confirm('Clear map?')) clearAllMarkers(); }} className="pointer-events-auto bg-white hand-border w-14 h-14 flex items-center justify-center shadow-doodle text-ink hover:bg-gray-100">
             <Trash2 size={24}/>
         </button>
      </div>

      {/* Schedule Drawer (Updated UI) */}
      {showSchedulePanel && (
          <div className="absolute top-24 left-4 z-20 pointer-events-none">
              <div className="bg-white hand-border shadow-doodle pointer-events-auto animate-[float_0.3s_ease-out] w-64 max-h-[60vh] flex flex-col overflow-hidden">
                  
                  {/* Header: Horizontal Day Scroll */}
                  <div className="bg-gray-50 border-b-2 border-ink p-2 flex overflow-x-auto no-scrollbar gap-2">
                     {/* Find max day from locations or default to 5 */}
                     {Array.from({length: Math.max(5, ...locations.map(l => l.day || 0))}, (_, i) => i + 1).map(day => (
                         <button 
                            key={day}
                            onClick={() => setSelectedScheduleDay(day)}
                            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border-2 whitespace-nowrap transition-colors ${selectedScheduleDay === day ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-gray-300'}`}
                         >
                            Day {day}
                         </button>
                     ))}
                  </div>

                  {/* Body: Vertical Location List */}
                  <div className="p-2 overflow-y-auto flex-1 bg-white">
                      {getDayMarkers(selectedScheduleDay).length === 0 ? (
                          <div className="text-center p-4 text-gray-400 font-bold text-xs">No markers imported for Day {selectedScheduleDay} yet.</div>
                      ) : (
                          <div className="space-y-2">
                              {getDayMarkers(selectedScheduleDay).map(marker => (
                                  <div 
                                    key={marker.id} 
                                    onClick={() => flyToLocation(marker.lat, marker.lng)}
                                    className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-yellow-50 hover:border-marker cursor-pointer transition-colors group"
                                  >
                                      <div className="font-bold text-xs text-ink w-10 text-right">{marker.time || '--:--'}</div>
                                      <div className="flex-1">
                                          <div className="font-bold text-sm text-ink group-hover:text-marker line-clamp-1">{marker.name}</div>
                                          <div className="text-[10px] text-gray-400 line-clamp-1">{marker.description}</div>
                                      </div>
                                      <ArrowRight size={14} className="text-gray-300 group-hover:text-marker"/>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  {/* Close Bar */}
                  <div className="p-2 border-t-2 border-ink bg-gray-50 text-center">
                       <button onClick={() => setShowSchedulePanel(false)} className="text-ink font-bold text-xs hover:underline">Close Schedule</button>
                  </div>
              </div>
          </div>
      )}

      {/* Route Calculation Panel */}
      {showRoutePanel && (
        <div className="absolute top-24 left-4 right-24 z-20 pointer-events-none">
            <div className="bg-white hand-border p-4 shadow-doodle pointer-events-auto animate-[float_0.3s_ease-out]">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-hand text-xl font-bold text-ink">Route Finder</h3>
                    <button onClick={() => setShowRoutePanel(false)}><X size={18} className="text-gray-400"/></button>
                </div>
                
                <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-ink rounded-full border border-white"></div>
                        <input value={routeStart} onChange={e => setRouteStart(e.target.value)} placeholder="Start..." className="flex-1 hand-input p-2 text-sm font-bold text-ink"/>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-marker rounded-full border border-white"></div>
                        <input value={routeEnd} onChange={e => setRouteEnd(e.target.value)} placeholder="End..." className="flex-1 hand-input p-2 text-sm font-bold text-ink"/>
                    </div>
                </div>

                <button 
                    onClick={handleCalculateRoute} 
                    disabled={isCalculating || !routeStart || !routeEnd}
                    className="w-full bg-ink text-white font-bold py-2 hand-border shadow-sm flex items-center justify-center gap-2 mb-3 hover:bg-blue-800"
                >
                    {isCalculating ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                    Calculate Time
                </button>

                {/* Results List */}
                <div className="space-y-3 max-h-56 overflow-y-auto no-scrollbar">
                    {routeResults.map((res, idx) => (
                        <div key={idx} className="bg-white border-2 border-ink p-3 rounded-[15px] relative">
                            <div className="absolute -top-2 -right-2 bg-marker text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-ink">
                                {res.label}
                            </div>
                            <div className="font-bold text-ink text-lg mb-1 font-hand">{res.duration}</div>
                            
                            <div className="flex flex-wrap items-center gap-1 text-xs font-bold text-ink/80">
                                {res.steps.map((step, sIdx) => (
                                    <React.Fragment key={sIdx}>
                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded border border-ink/30">{step}</span>
                                        {sIdx < res.steps.length - 1 && <ArrowRight size={10} />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    ))}
                    {routeResults.length === 0 && !isCalculating && (
                        <div className="text-center text-xs text-gray-400 font-bold py-2">Enter locations to see 3 options</div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
