import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Map as MapIcon, ChevronRight, Activity, Calendar, FileStack, Settings, Crosshair, HelpCircle, MessageSquare, Plus, Minus, MousePointer2, AlertTriangle, Play, Pause, ChevronLeft, ChevronRight as IconChevronRight } from 'lucide-react';
import AppNavigation from '../../components/AppNavigation';
import MapViewport from '../../components/MapViewport';
import './Compare.css';

export default function Compare() {
  const routerLocation = useLocation();
  const initialCoords = routerLocation.state?.coords || { lng: 72.5714, lat: 23.0225 };

  const [map1, setMap1] = useState(null);
  const [map2, setMap2] = useState(null);
  const [mode, setMode] = useState('split'); // split, difference, flicker
  const [splitPos, setSplitPos] = useState(50); // percentage 0-100
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCoords, setHoverCoords] = useState(null);
  const [markerCoords, setMarkerCoords] = useState(initialCoords);
  const [flickerActive, setFlickerActive] = useState(false);
  const [flickerState, setFlickerState] = useState('before'); // before, after
  const [timelineDate, setTimelineDate] = useState('10 Sep 2026');
  
  const sliderRef = useRef(null);
  const isSyncingLeft = useRef(false);
  const isSyncingRight = useRef(false);

  // Sync maps
  useEffect(() => {
    if (!map1 || !map2) return;

    const syncLeft = () => {
      if (isSyncingRight.current) return;
      isSyncingLeft.current = true;
      map2.jumpTo({
        center: map1.getCenter(),
        zoom: map1.getZoom(),
        bearing: map1.getBearing(),
        pitch: map1.getPitch()
      });
      isSyncingLeft.current = false;
    };

    const syncRight = () => {
      if (isSyncingLeft.current) return;
      isSyncingRight.current = true;
      map1.jumpTo({
        center: map2.getCenter(),
        zoom: map2.getZoom(),
        bearing: map2.getBearing(),
        pitch: map2.getPitch()
      });
      isSyncingRight.current = false;
    };

    map1.on('move', syncLeft);
    map2.on('move', syncRight);

    return () => {
      map1.off('move', syncLeft);
      map2.off('move', syncRight);
    };
  }, [map1, map2]);

  // Handle Dragging
  const handlePointerDown = (e) => {
    if (mode !== 'split') return;
    setIsDragging(true);
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !sliderRef.current) return;
    const rect = sliderRef.current.parentElement.getBoundingClientRect();
    let pos = ((e.clientX - rect.left) / rect.width) * 100;
    pos = Math.max(5, Math.min(95, pos));
    setSplitPos(pos);
  }, [isDragging]);

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.target.releasePointerCapture(e.pointerId);
  };

  // Flicker effect
  useEffect(() => {
    if (mode !== 'flicker' || !flickerActive) return;
    const interval = setInterval(() => {
      setFlickerState(s => s === 'before' ? 'after' : 'before');
    }, 800);
    return () => clearInterval(interval);
  }, [mode, flickerActive]);

  // Set different tile source for map2 to simulate a different date
  useEffect(() => {
    if (map2 && map2.getSource('satellite')) {
      // For demonstration, map2 gets a modified style or just the same satellite but we pretend it's different.
      // In a real app, we'd update the tile URL to point to a different date.
    }
  }, [map2, timelineDate]);

  return (
    <div className="compare-container">
      <AppNavigation />

      {/* TOP CONTROL BAR */}
      <div className="compare-top-bar glass-panel text-xs font-mono text-gray">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-dim uppercase mb-0.5">Location</span>
            <span className="text-white flex items-center gap-2">
              <Crosshair size={12} className="text-accent-blue" />
              Ebro Delta Estuary
            </span>
          </div>
          <div className="h-6 w-px bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-dim uppercase mb-0.5">Baseline</span>
            <span className="text-white">10 Sep 2026</span>
          </div>
          <div className="h-6 w-px bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-accent-blue uppercase mb-0.5">Current</span>
            <span className="text-white font-bold">{timelineDate}</span>
          </div>
          <div className="h-6 w-px bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-dim uppercase mb-0.5">Dataset</span>
            <span className="text-white">Sentinel-2 10m</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-md border border-white/5">
          <button 
            className={`px-3 py-1.5 rounded-sm transition-colors ${mode === 'split' ? 'bg-accent-blue text-white' : 'text-gray hover:text-white'}`}
            onClick={() => setMode('split')}
          >
            Split View
          </button>
          <button 
            className={`px-3 py-1.5 rounded-sm transition-colors ${mode === 'difference' ? 'bg-accent-blue text-white' : 'text-gray hover:text-white'}`}
            onClick={() => setMode('difference')}
          >
            Difference
          </button>
          <button 
            className={`px-3 py-1.5 rounded-sm transition-colors ${mode === 'flicker' ? 'bg-accent-blue text-white' : 'text-gray hover:text-white'}`}
            onClick={() => { setMode('flicker'); setFlickerActive(true); }}
          >
            Flicker
          </button>
        </div>
      </div>

      {/* MAPS AREA */}
      <div 
        className="compare-maps-wrapper" 
        ref={sliderRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* BASELINE MAP (LEFT / BOTTOM) */}
        <div className="map-layer baseline-layer" style={{ opacity: 1 }}>
          <MapViewport 
            center={[initialCoords.lng, initialCoords.lat]} 
            zoom={13}
            onMapLoad={setMap1}
            hoverCoords={hoverCoords}
            setHoverCoords={setHoverCoords}
            markerCoords={markerCoords}
            onMapClick={setMarkerCoords}
          />
          {mode === 'split' && (
            <div className="layer-label glass-panel">BASELINE / 10 SEP 2026</div>
          )}
        </div>

        {/* CURRENT MAP (RIGHT / TOP) */}
        <div 
          className="map-layer current-layer"
          style={{ 
            clipPath: mode === 'split' ? `inset(0 0 0 ${splitPos}%)` : 'none',
            opacity: mode === 'difference' ? 0.4 : (mode === 'flicker' && flickerState === 'before') ? 0 : 1,
            pointerEvents: mode === 'split' ? 'auto' : 'none',
            mixBlendMode: mode === 'difference' ? 'screen' : 'normal'
          }}
        >
          <MapViewport 
            center={[initialCoords.lng, initialCoords.lat]} 
            zoom={13}
            onMapLoad={setMap2}
          />
          {mode === 'split' && (
            <div className="layer-label right glass-panel">CURRENT / {timelineDate}</div>
          )}
        </div>

        {/* SPLIT SLIDER */}
        {mode === 'split' && (
          <div 
            className="split-divider"
            style={{ left: `${splitPos}%` }}
            onPointerDown={handlePointerDown}
          >
            <div className="split-handle">
              <ChevronLeft size={14} className="text-gray" />
              <div className="w-px h-4 bg-white/20 mx-0.5"></div>
              <IconChevronRight size={14} className="text-gray" />
            </div>
          </div>
        )}

        {/* DIFFERENCE OVERLAY (MOCK) */}
        {mode === 'difference' && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-accent-blue bg-accent-blue/20 rounded-full animate-pulse flex items-center justify-center">
              <div className="bg-black/60 px-3 py-1 rounded text-xs font-mono text-accent-blue border border-accent-blue/30 backdrop-blur-md">
                +21.7% CHANGE DETECTED
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TIMELINE */}
      <div className="compare-timeline glass-panel">
        <div className="flex items-center gap-4 w-full">
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-gray hover:text-white transition-colors" onClick={() => setTimelineDate('26 Aug 2026')}><ChevronLeft size={16} /></button>
            <button 
              className="p-2 bg-white/10 hover:bg-accent-blue text-white rounded-full transition-colors"
              onClick={() => { if (mode==='flicker') setFlickerActive(!flickerActive); }}
            >
              {mode === 'flicker' && flickerActive ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <button className="p-1.5 text-gray hover:text-white transition-colors" onClick={() => setTimelineDate('24 Sep 2026')}><IconChevronRight size={16} /></button>
          </div>
          
          <div className="timeline-track-container flex-1">
            <div className="text-[10px] font-mono text-gray-dim uppercase mb-2 flex justify-between">
              <span>Interval Window: 14 Days (Δ 2 Orbits)</span>
              <span className="text-accent-blue flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent-blue"></span> T1 Event
              </span>
            </div>
            
            <div className="timeline-track relative h-1 bg-white/10 rounded-full">
              <div className="absolute top-0 left-[20%] right-[20%] h-full bg-accent-blue/30 rounded-full"></div>
              
              <div className="absolute top-1/2 -translate-y-1/2 left-[20%] w-3 h-3 bg-gray rounded-full border-2 border-black cursor-pointer hover:scale-125 transition-transform" onClick={() => setTimelineDate('10 Sep 2026')}></div>
              <div className="absolute top-1/2 -translate-y-1/2 left-[80%] w-3 h-3 bg-accent-blue rounded-full border-2 border-black cursor-pointer shadow-[0_0_8px_rgba(37,99,235,0.8)] z-10 scale-125"></div>
              
              <div className="absolute top-6 left-[20%] -translate-x-1/2 text-[10px] font-mono text-gray">10 Sep</div>
              <div className="absolute top-6 left-[80%] -translate-x-1/2 text-[10px] font-mono text-white font-bold">24 Sep</div>
            </div>
          </div>
        </div>
      </div>

      {/* RESULT PANEL (MOCK) */}
      <AnimatePresence>
        {true && (
          <motion.div 
            className="compare-result-panel glass-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-[10px] font-mono text-success-mint font-bold">
                <div className="w-1.5 h-1.5 rounded-full bg-success-mint animate-pulse"></div>
                CHANGE CONFIRMED
              </div>
              <div className="text-[10px] font-mono text-gray-dim bg-white/5 px-2 py-0.5 rounded">NDWI Δ &gt; 0.35</div>
            </div>
            
            <div className="text-[10px] font-mono text-gray-dim uppercase mb-1">Detection Classification</div>
            <h3 className="text-lg font-medium text-white mb-6">Surface Water Expansion</h3>
            
            <div className="flex items-end justify-between mb-4 pb-4 border-b border-white/10">
              <div>
                <div className="text-[10px] font-mono text-gray-dim uppercase mb-1">Affected Region</div>
                <div className="text-2xl font-bold text-white">12.8 <span className="text-xs font-normal text-gray">km²</span></div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-gray-dim uppercase mb-1">Runoff Extension</div>
                <div className="text-xl font-bold text-success-mint">+21.7%</div>
              </div>
            </div>
            
            <div className="flex justify-between text-xs font-mono text-gray-dim mb-6">
              <span>Baseline variance:</span>
              <span className="text-white">+2.7 km² vs 10 Sep</span>
            </div>
            
            <button className="w-full py-2 bg-accent-blue hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2">
              View Evidence <IconChevronRight size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
