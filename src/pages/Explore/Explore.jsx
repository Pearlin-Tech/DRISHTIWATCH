import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Calendar, Layers, Map as MapIcon, ChevronRight, 
  MessageSquare, Plus, Minus, Crosshair, Sparkles, Navigation,
  Menu, Eye, Calendar as CalendarIcon, FileStack, Settings, Activity, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import maplibregl from '../../lib/maplibre';
import './Explore.css';

export default function Explore() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const [lng, setLng] = useState(72.5714);
  const [lat, setLat] = useState(23.0225);
  const [zoom, setZoom] = useState(12);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [activeLayer, setActiveLayer] = useState('satellite');
  const [layersOpen, setLayersOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [markerCoords, setMarkerCoords] = useState(null);
  const [hoverCoords, setHoverCoords] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [layerOpacity, setLayerOpacity] = useState(100);
  const [aiState, setAiState] = useState('idle'); // idle, loading, result
  const [aiResult, setAiResult] = useState(null);
  
  // Geolocation state
  const [locatingState, setLocatingState] = useState('idle'); // idle, locating, success, denied, error
  const [userLocation, setUserLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);

  const [mapError, setMapError] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (map.current) return; // initialize map only once
    
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: 'raster',
              tiles: [
                'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
              ],
              tileSize: 256,
              attribution: 'Google'
            }
          },
          layers: [
            {
              id: 'satellite-layer',
              type: 'raster',
              source: 'satellite',
              minzoom: 0,
              maxzoom: 22
            }
          ]
        },
        center: [lng, lat],
        zoom: zoom,
        attributionControl: false
      });

      map.current.on('load', () => {
        setIsLoading(false);
        // We would add satellite imagery layers here
      });

      map.current.on('move', () => {
        setLng(map.current.getCenter().lng.toFixed(4));
        setLat(map.current.getCenter().lat.toFixed(4));
        setZoom(map.current.getZoom().toFixed(2));
      });

      map.current.on('mousemove', (e) => {
        // Throttle state update using requestAnimationFrame
        requestAnimationFrame(() => {
          setHoverCoords({
            lng: e.lngLat.lng.toFixed(4),
            lat: e.lngLat.lat.toFixed(4),
            x: e.point.x,
            y: e.point.y
          });
        });
      });

      map.current.on('mouseout', () => {
        setHoverCoords(null);
      });

      map.current.on('click', (e) => {
        setMarkerCoords(e.lngLat);
        setInspectorOpen(true);
        setAiPanelOpen(false);
        setLayersOpen(false);
      });
    } catch (err) {
      console.error('Map initialization failed in Explore:', err);
      setMapError(true);
      setIsLoading(false);
    }
  }, [lng, lat, zoom]);

  // Handle Escape key to close panels
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLayersOpen(false);
        setInspectorOpen(false);
        setAiPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync selected location marker
  useEffect(() => {
    if (!map.current) return;
    
    if (markerCoords) {
      if (!markerRef.current) {
        // Create a custom DOM element for the marker
        const el = document.createElement('div');
        el.className = 'custom-map-marker';
        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([markerCoords.lng, markerCoords.lat])
          .addTo(map.current);
      } else {
        markerRef.current.setLngLat([markerCoords.lng, markerCoords.lat]);
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [markerCoords]);

  // Sync user location marker
  useEffect(() => {
    if (!map.current) return;
    
    if (userLocation) {
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        const inner = document.createElement('div');
        inner.className = 'user-location-dot';
        el.appendChild(inner);
        
        userMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map.current);
      } else {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      }
    }
  }, [userLocation]);

  const handleZoomIn = () => map.current?.zoomIn();
  const handleZoomOut = () => map.current?.zoomOut();
  const handleResetView = () => map.current?.flyTo({ center: [72.5714, 23.0225], zoom: 12 });

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setLocatingState('error');
      return;
    }
    
    setLocatingState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy: locAccuracy } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setAccuracy(Math.round(locAccuracy));
        setLocatingState('success');
        
        map.current?.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          duration: 2500
        });
      },
      (error) => {
        setLocatingState(error.code === 1 ? 'denied' : 'error');
        setTimeout(() => setLocatingState('idle'), 4000);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      // Simulate finding a location
      const simulatedCoords = { lng: -122.4194, lat: 37.7749 };
      setMarkerCoords(simulatedCoords);
      setInspectorOpen(true);
      map.current?.flyTo({
        center: [simulatedCoords.lng, simulatedCoords.lat],
        zoom: 13,
        duration: 2000
      });
    }
  };

  const handleAiSubmit = () => {
    setAiState('loading');
    setTimeout(() => {
      setAiState('result');
      setAiResult({
        title: 'WATER EXPANSION DETECTED',
        area: '12.8 km²'
      });
      const simulatedCoords = { lng: 72.5714, lat: 23.0225 };
      setMarkerCoords(simulatedCoords);
      setActiveLayer('ndwi');
      map.current?.flyTo({
        center: [simulatedCoords.lng, simulatedCoords.lat],
        zoom: 13,
        duration: 2000
      });
    }, 1500);
  };

  return (
    <div className="explore-container">
      {/* MAP BACKGROUND */}
      <div className={`map-container ${hoverCoords ? 'crosshair-active' : ''}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        {mapError ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black text-gray">
            <div className="text-warning mb-2 text-xl font-bold">MAP UNAVAILABLE</div>
            <div className="text-sm">Unable to initialize map engine. Features may be limited.</div>
            <button className="btn-secondary mt-4" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      {/* HOVER CROSSHAIR GUIDES */}
      <AnimatePresence>
        {hoverCoords && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="crosshair-guides"
          >
            <div className="crosshair-guide-h" style={{ top: hoverCoords.y }} />
            <div className="crosshair-guide-v" style={{ left: hoverCoords.x }} />
            
            <div 
              className="hover-coordinate-indicator glass-panel text-xs font-mono"
              style={{ left: hoverCoords.x + 15, top: hoverCoords.y + 15 }}
            >
              <div>LAT {hoverCoords.lat}° N</div>
              <div>LON {hoverCoords.lng}° E</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP LOADING STATE */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            className="map-loading-indicator glass-panel text-xs font-mono"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <span className="indicator animate-pulse"></span>
            SHELL READY · LOADING IMAGERY
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEFT NAVIGATION RAIL */}
      <motion.nav 
        className="explore-nav-rail glass-panel"
        animate={{ width: isNavExpanded ? 220 : 72 }}
        onMouseEnter={() => setIsNavExpanded(true)}
        onMouseLeave={() => setIsNavExpanded(false)}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="nav-rail-header">
          <div className="brand-sat">SQ</div>
        </div>
        
        <div className="nav-rail-links">
          <NavItem icon={<MapIcon size={20} />} label="Explore" path="/explore" active expanded={isNavExpanded} />
          <NavItem icon={<MessageSquare size={20} />} label="Ask" path="/ask" expanded={isNavExpanded} />
          <NavItem icon={<Activity size={20} />} label="Detect" path="/detect" expanded={isNavExpanded} />
          <NavItem icon={<Layers size={20} />} label="Compare" path="/compare" expanded={isNavExpanded} />
          <NavItem icon={<Navigation size={20} />} label="Measure" path="/measure" expanded={isNavExpanded} />
          <NavItem icon={<Eye size={20} />} label="Watch" path="/watch" expanded={isNavExpanded} />
          <NavItem icon={<Clock size={20} />} label="Timeline" path="/timeline" expanded={isNavExpanded} />
        </div>

        <div className="nav-rail-footer">
          <NavItem icon={<Settings size={20} />} label="Settings" path="/settings" expanded={isNavExpanded} />
        </div>
      </motion.nav>

      {/* TOP COMMAND BAR */}
      <div className="top-command-bar">
        <div className="search-box glass-panel">
          <Search size={16} className="text-gray" />
          <input 
            type="text" 
            placeholder="Search city, region, coordinates..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
        
        <div className="command-controls">
          <button className="command-btn glass-panel text-xs font-mono">
            <CalendarIcon size={14} className="mr-2 text-gray" />
            DATE: <span className="text-white ml-1">24 Sep 2026</span>
            <ChevronRight size={14} className="ml-1 text-gray" />
          </button>
          
          <button className="command-btn glass-panel text-xs font-mono">
            <FileStack size={14} className="mr-2 text-gray" />
            DATASET: <span className="text-white ml-1">Sentinel-2</span>
            <ChevronRight size={14} className="ml-1 text-gray" />
          </button>
          
          <button 
            className={`command-btn glass-panel text-xs font-mono ${layersOpen ? 'active' : ''}`}
            onClick={() => setLayersOpen(!layersOpen)}
          >
            <Layers size={14} className="mr-2 text-gray" />
            LAYERS
          </button>
        </div>
      </div>

      {/* SPECTRAL LAYERS PANEL */}
      <AnimatePresence>
        {layersOpen && (
          <motion.div 
            className="layers-panel glass-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="panel-header flex items-center justify-between text-xs font-mono text-gray">
              <span>SPECTRAL LAYERS</span>
              <button onClick={() => setLayersOpen(false)}><ChevronRight size={14} className="rotate-[-90deg]"/></button>
            </div>
            <div className="layer-options mt-4">
              <label className={`layer-option ${activeLayer === 'satellite' ? 'active' : ''}`}>
                <input type="radio" name="layer" checked={activeLayer === 'satellite'} onChange={() => setActiveLayer('satellite')} />
                <span className="text-sm flex-1">Satellite / True Color</span>
                {activeLayer === 'satellite' && <span className="layer-badge">RGB</span>}
              </label>
              <label className={`layer-option ${activeLayer === 'optical' ? 'active' : ''}`}>
                <input type="radio" name="layer" checked={activeLayer === 'optical'} onChange={() => setActiveLayer('optical')} />
                <span className="text-sm flex-1">Optical / False Color</span>
                {activeLayer === 'optical' && <span className="layer-badge">NIR</span>}
              </label>
              <label className={`layer-option ${activeLayer === 'sar' ? 'active' : ''}`}>
                <input type="radio" name="layer" checked={activeLayer === 'sar'} onChange={() => setActiveLayer('sar')} />
                <span className="text-sm flex-1">SAR (Radar)</span>
              </label>
              <label className={`layer-option ${activeLayer === 'ndvi' ? 'active' : ''}`}>
                <input type="radio" name="layer" checked={activeLayer === 'ndvi'} onChange={() => setActiveLayer('ndvi')} />
                <span className="text-sm flex-1">NDVI (Vegetation)</span>
              </label>
              <label className={`layer-option ${activeLayer === 'ndwi' ? 'active' : ''}`}>
                <input type="radio" name="layer" checked={activeLayer === 'ndwi'} onChange={() => setActiveLayer('ndwi')} />
                <span className="text-sm flex-1">NDWI (Water)</span>
              </label>
              <label className={`layer-option ${activeLayer === 'change' ? 'active' : ''}`}>
                <input type="radio" name="layer" checked={activeLayer === 'change'} onChange={() => setActiveLayer('change')} />
                <span className="text-sm flex-1">Change Detection</span>
              </label>
            </div>
            
            <div className="opacity-control mt-6 pt-4 border-t border-white-10">
              <div className="flex justify-between text-xs font-mono mb-2">
                <span className="text-gray">OPACITY</span>
                <span className="text-accent-blue">{layerOpacity}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={layerOpacity} 
                onChange={(e) => setLayerOpacity(e.target.value)} 
                className="opacity-slider"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOCATION INSPECTOR */}
      <AnimatePresence>
        {inspectorOpen && markerCoords && (
          <motion.div 
            className="location-inspector glass-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <button className="close-btn" onClick={() => setInspectorOpen(false)}>×</button>
            <h3 className="inspector-title">SELECTED LOCATION</h3>
            <p className="inspector-subtitle text-gray text-xs font-mono">
              {markerCoords.lat.toFixed(4)}° N, {markerCoords.lng.toFixed(4)}° E
            </p>
            
            <div className="inspector-meta text-xs font-mono mt-4">
              <div><span className="text-gray">SOURCE</span> Sentinel-2</div>
              <div><span className="text-gray">STATUS</span> Latest available imagery</div>
            </div>
            
            <div className="inspector-actions mt-6">
              <button className="btn-primary w-full justify-center mb-2" onClick={() => {
                navigate('/ask', { state: { coords: markerCoords, layer: activeLayer } });
              }}>
                ASK SATQUERY <Sparkles size={14} className="ml-2" />
              </button>
              <div className="flex gap-2">
                <button 
                  className="btn-secondary flex-1 text-xs py-2"
                  onClick={() => navigate('/compare', { state: { coords: markerCoords } })}
                >
                  COMPARE
                </button>
                <button 
                  className="btn-secondary flex-1 text-xs py-2"
                  onClick={() => navigate('/watch', { state: { coords: markerCoords } })}
                >
                  WATCH
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI ASSISTANT PANEL */}
      <AnimatePresence>
        {aiPanelOpen && (
          <motion.div 
            className="ai-assistant-panel glass-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <button className="close-btn" onClick={() => setAiPanelOpen(false)}>×</button>
            <div className="ai-header flex items-center mb-4">
              <Sparkles size={16} className="text-accent-blue mr-2" />
              <span className="font-mono text-xs font-bold">SATQUERY AI</span>
            </div>
            <p className="text-sm text-gray mb-4">What would you like to know about this area?</p>
            
            {aiState === 'idle' && (
              <>
                <div className="ai-suggestions flex flex-col gap-2 mb-4">
                  <button className="suggestion-btn text-xs text-left">What's changed here?</button>
                  <button className="suggestion-btn text-xs text-left" onClick={handleAiSubmit}>Find water expansion</button>
                  <button className="suggestion-btn text-xs text-left">Check vegetation health</button>
                </div>
                
                <div className="ai-input-wrapper">
                  <input type="text" placeholder="Ask a question..." className="ai-input text-sm" />
                  <button className="ai-submit" onClick={handleAiSubmit}><ChevronRight size={16} /></button>
                </div>
              </>
            )}

            {aiState === 'loading' && (
              <div className="py-6 flex flex-col items-center justify-center">
                <div className="indicator animate-pulse mb-4"></div>
                <div className="text-xs font-mono text-accent-blue">ANALYSING IMAGERY...</div>
              </div>
            )}

            {aiState === 'result' && aiResult && (
              <div className="ai-result mt-2">
                <div className="text-success-mint font-bold text-xs font-mono mb-2">{aiResult.title}</div>
                <div className="text-sm text-gray mb-4">Affected area: <span className="text-white">{aiResult.area}</span></div>
                
                <div className="flex gap-2 mt-4">
                  <button className="btn-primary flex-1 text-xs py-2" onClick={() => setAiState('idle')}>VIEW ON MAP</button>
                  <button className="btn-secondary flex-1 text-xs py-2">VIEW EVIDENCE</button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING AI BUTTON (if panel closed) */}
      {!aiPanelOpen && (
        <button 
          className="floating-ai-btn btn-primary"
          onClick={() => setAiPanelOpen(true)}
        >
          <Sparkles size={16} className="mr-2" /> ASK SATQUERY
        </button>
      )}

      {/* ZOOM & LOCATION CONTROLS */}
      <div className="map-controls">
        <button className="control-btn glass-panel" onClick={handleZoomIn} aria-label="Zoom In"><Plus size={18} /></button>
        <button className="control-btn glass-panel" onClick={handleZoomOut} aria-label="Zoom Out"><Minus size={18} /></button>
        <button className="control-btn glass-panel mt-2" onClick={handleMyLocation} aria-label="My Location">
          <Navigation size={18} className={locatingState === 'locating' ? 'animate-pulse text-accent-blue' : ''} />
        </button>
        <button className="control-btn glass-panel mt-2" onClick={handleResetView} aria-label="Reset View"><Crosshair size={18} /></button>
      </div>

      {/* MY LOCATION STATUS TOAST */}
      <AnimatePresence>
        {locatingState !== 'idle' && (
          <motion.div 
            className="location-status-toast glass-panel text-xs font-mono"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {locatingState === 'locating' && <><span className="indicator animate-pulse mr-2"></span>LOCATING...</>}
            {locatingState === 'success' && <><span className="indicator mr-2"></span>MY LOCATION • ACCURACY ±{accuracy}m</>}
            {locatingState === 'denied' && <span className="text-warning-amber">LOCATION ACCESS BLOCKED</span>}
            {locatingState === 'error' && <span className="text-danger-red">LOCATION UNAVAILABLE</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM STATUS BAR */}
      <div className="bottom-status-bar glass-panel text-xs font-mono text-gray">
        <span>LAT {lat}°</span>
        <span className="mx-2 text-gray-dim">|</span>
        <span>LON {lng}°</span>
        <span className="mx-2 text-gray-dim">|</span>
        <span>ZOOM {zoom}</span>
        <span className="mx-2 text-gray-dim">|</span>
        <span>10 km</span>
        <span className="mx-2 text-gray-dim">|</span>
        <span>Sentinel-2</span>
        <span className="mx-2 text-gray-dim">|</span>
        <span className="text-accent-blue ml-4">LIVE</span>
      </div>
    </div>
  );
}

function NavItem({ icon, label, path, active, expanded }) {
  const navigate = useNavigate();
  return (
    <div 
      className={`nav-item ${active ? 'active' : ''}`} 
      onClick={() => path ? navigate(path) : null}
      style={{ cursor: path ? 'pointer' : 'default' }}
    >
      <div className="nav-icon">{icon}</div>
      <AnimatePresence>
        {expanded && (
          <motion.span 
            className="nav-label"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
