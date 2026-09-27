import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowUp, X, Activity, CheckCircle2, CircleDashed, ChevronRight, HelpCircle, Map as MapIcon, Minus, Plus, Crosshair, Navigation, AlertTriangle, ShieldCheck, Info, Layers, Compass, HelpCircle as HelpIcon, ChevronDown, ChevronUp, BookOpen, Cpu, Paperclip, Upload, Image as ImageIcon, MapPin, Sparkles } from 'lucide-react';
import AppNavigation from '../../components/AppNavigation';
import MapViewport from '../../components/MapViewport';
import { aiService } from '../../services/aiService';
import { validateGeoTiffFile, processClientGeoTiff } from '../../utils/geotiffClient';
import './Ask.css';

const METRIC_LABELS = {
  roiAreaKm2: 'ROI Area',
  affectedAreaKm2: 'Affected Area',
  affectedPercent: 'Affected Share',
  changePercentage: 'Change Shift',
  baselineIndexValue: 'Baseline Index Value',
  targetIndexValue: 'Target Index Value',
  indexDelta: 'Index Delta',
  affectedArea: 'Affected Area',
  shareOfSelectedArea: 'Share of Selected Area',
  measurementChange: 'Measurement Change',
  candidateCount: 'Candidate Zones',
  candidateZones: 'Candidate Zones',
  visibleArea: 'Visible Area',
  hectares: 'Hectares',
  elevation: 'Elevation',
  totalArea: 'Total Area',
  diagonalDistance: 'Diagonal Distance',
  satellitePasses: 'Satellite Passes',
  imageDetail: 'Image Resolution',
  cloudCover: 'Cloud Cover',
  satelliteRevisit: 'Satellite Revisit',
  overallShift: 'Overall Shift',
  viewportAreaKm2: 'Viewport Area',
  totalScenesFound: 'Total Scenes Found',
  resolution: 'Spatial Resolution',
  changeMagnitude: 'Change Shift'
};

const formatMetricLabel = (key) => {
  if (!key) return '';
  if (METRIC_LABELS[key]) return METRIC_LABELS[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/([0-9]+)/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/ Km 2/gi, ' (km²)')
    .replace(/ Area Km 2/gi, ' Area (km²)')
    .trim();
};

export default function Ask() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  
  // Inherit context from Explore if available
  const initialCoords = routerLocation.state?.coords || { lng: 72.5714, lat: 23.0225 };

  // Mode state: 'explorer' (default) or 'expert'
  const [mode, setMode] = useState(() => localStorage.getItem('satquery_ai_mode') || 'explorer');
  
  // Selected Location context from entryPoint navigation
  const [selectedLocation, setSelectedLocation] = useState(() => {
    return routerLocation.state?.selectedLocation || (routerLocation.state?.entryPoint === 'selected_location' ? routerLocation.state?.coords : null);
  });
  const [entryPoint, setEntryPoint] = useState(() => routerLocation.state?.entryPoint || 'direct_navigation');
  const [dataset, setDataset] = useState(() => routerLocation.state?.dataset || 'Sentinel-2');
  const [selectedDate, setSelectedDate] = useState(() => routerLocation.state?.selectedDate || '24 Sep 2026');

  const [hoverCoords, setHoverCoords] = useState(null);
  const [markerCoords, setMarkerCoords] = useState(initialCoords);
  const [query, setQuery] = useState('');
  
  const [flowState, setFlowState] = useState('idle'); // idle, understanding, analysing, verifying, ready, error
  const [result, setResult] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [expandedLearnItem, setExpandedLearnItem] = useState(null);
  const [history, setHistory] = useState([]);

  // Map Controls
  const [mapInstance, setMapInstance] = useState(null);

  // GeoTIFF Attachment states
  const [attachmentState, setAttachmentState] = useState('IDLE'); // IDLE, SELECTING, VALIDATING, UPLOADING, PROCESSING, READY, ERROR
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentMeta, setAttachmentMeta] = useState(null);
  const [attachmentError, setAttachmentError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = async (file) => {
    if (!file) return;

    setAttachmentError(null);
    setAttachmentState('VALIDATING');

    const val = validateGeoTiffFile(file);
    if (!val.valid) {
      setAttachmentError(val.error);
      setAttachmentState('ERROR');
      return;
    }

    try {
      setAttachmentState('PROCESSING');
      const clientMeta = await processClientGeoTiff(file);

      setAttachmentState('UPLOADING');
      const uploadRes = await aiService.uploadRaster(file);

      setAttachmentMeta({
        ...clientMeta,
        ...uploadRes.metadata,
        attachmentId: uploadRes.attachmentId,
        filename: uploadRes.filename,
        sizeMb: uploadRes.sizeMb
      });
      setAttachmentFile(file);
      setAttachmentState('READY');
    } catch (err) {
      console.error('GeoTIFF upload error:', err);
      setAttachmentError(err.message || 'This file could not be read as a valid TIFF/GeoTIFF.');
      setAttachmentState('ERROR');
    }
  };

  const clearAttachment = () => {
    setAttachmentState('IDLE');
    setAttachmentFile(null);
    setAttachmentMeta(null);
    setAttachmentError(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem('satquery_ai_mode', newMode);
  };

  const handleQuerySubmit = (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    executeAskQuery(query.trim());
  };

  const handleQuickPrompt = (promptText) => {
    setQuery(promptText);
    executeAskQuery(promptText);
  };

  const executeAskQuery = async (questionText) => {
    if (!questionText) return;

    setFlowState('understanding');

    try {
      await new Promise(r => setTimeout(r, 200));
      setFlowState('analysing');

      const bounds = mapInstance ? mapInstance.getBounds() : null;
      const currentZoom = mapInstance ? mapInstance.getZoom() : 13;

      const mapContext = {
        center: {
          lat: markerCoords.lat,
          lon: markerCoords.lng ?? markerCoords.lon
        },
        zoom: currentZoom,
        bounds: bounds ? {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        } : null
      };

      await new Promise(r => setTimeout(r, 200));
      setFlowState('verifying');

      const resData = await aiService.ask({
        question: questionText || (attachmentMeta ? "Analyze this uploaded GeoTIFF image." : "What changed here?"),
        mapContext,
        mode,
        history,
        attachment: attachmentMeta ? { attachmentId: attachmentMeta.attachmentId, filename: attachmentMeta.filename } : null,
        selectedLocation: selectedLocation ? {
          lat: selectedLocation.lat,
          lon: selectedLocation.lon || selectedLocation.lng
        } : null,
        entryPoint,
        dataset,
        selectedDate
      });

      setFlowState('ready');
      setResult(resData);

      // Save turn to history
      setHistory(prev => [...prev, { question: questionText, analysisType: resData.analysisType, result: resData }]);

      // Render GeoJSON highlight if available
      if (resData.geojson && mapInstance) {
        try {
          if (mapInstance.getSource('ai-ask-result')) {
            mapInstance.getSource('ai-ask-result').setData(resData.geojson);
          } else {
            mapInstance.addSource('ai-ask-result', {
              type: 'geojson',
              data: resData.geojson
            });
            mapInstance.addLayer({
              id: 'ai-ask-result-fill',
              type: 'fill',
              source: 'ai-ask-result',
              paint: {
                'fill-color': '#00F0FF',
                'fill-opacity': 0.35
              }
            });
            mapInstance.addLayer({
              id: 'ai-ask-result-outline',
              type: 'line',
              source: 'ai-ask-result',
              paint: {
                'line-color': '#00F0FF',
                'line-width': 2
              }
            });
          }
        } catch (err) {
          console.warn('GeoJSON layer render error:', err);
        }
      }

      if (resData.location && mapInstance) {
        mapInstance.flyTo({
          center: [resData.location.lon, resData.location.lat],
          zoom: 13,
          duration: 1500
        });
      }
    } catch (err) {
      console.error('Ask Query Failure:', err);
      setFlowState('ready');
      setResult({
        status: 'ERROR',
        title: 'Backend Server Offline',
        answer: 'Unable to reach backend API at http://localhost:3001. Please run `npm run server` or `node server.js` to start the backend on port 3001.',
        evidence: [],
        sources: []
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowEvidence(false);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const resetFlow = () => {
    setFlowState('idle');
    setResult(null);
    setQuery('');
    setShowEvidence(false);

    if (mapInstance && mapInstance.getSource('ai-ask-result')) {
      try {
        mapInstance.removeLayer('ai-ask-result-fill');
        mapInstance.removeLayer('ai-ask-result-outline');
        mapInstance.removeSource('ai-ask-result');
      } catch (err) {
        console.warn('Map cleanup error:', err);
      }
    }
  };

  const highlightMapResult = () => {
    if (result?.location && mapInstance) {
      mapInstance.flyTo({
        center: [result.location.lon, result.location.lat],
        zoom: 14,
        duration: 1500
      });
    }
  };

  const overlayRasterOnMap = () => {
    if (!result || !result.overlayCoordinates || !mapInstance) return;

    try {
      const sourceId = 'uploaded-raster-source';
      const layerId = 'uploaded-raster-layer';

      const imageUrl = result.attachment?.metadata?.previewUrl || result.attachment?.metadata?.previewDataUrl;

      if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

      if (imageUrl) {
        mapInstance.addSource(sourceId, {
          type: 'image',
          url: imageUrl,
          coordinates: result.overlayCoordinates
        });

        mapInstance.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: { 'raster-opacity': 0.85 }
        });
      }

      const coords = result.overlayCoordinates;
      const west = coords[0][0];
      const north = coords[0][1];
      const east = coords[1][0];
      const south = coords[2][1];

      mapInstance.fitBounds(
        [[west, south], [east, north]],
        { padding: 80, duration: 2000 }
      );
    } catch (err) {
      console.warn('MapLibre raster overlay error:', err);
    }
  };

  // Extract active mode view from result evidence
  const activeView = result ? (mode === 'expert' ? (result.expert || result) : (result.explorer || result)) : null;

  return (
    <div className="ask-container">
      <AppNavigation />
      
      <MapViewport 
        center={[initialCoords.lng, initialCoords.lat]} 
        zoom={13}
        hoverCoords={hoverCoords}
        setHoverCoords={setHoverCoords}
        markerCoords={markerCoords}
        onMapClick={(coords) => {
          setMarkerCoords(coords);
          setSelectedLocation({ lat: coords.lat, lon: coords.lng });
          setEntryPoint('selected_location');
        }}
        onMapLoad={setMapInstance}
      >
        
        {/* TOP STATUS BAR */}
        <div className="ask-top-bar glass-panel text-xs font-mono text-gray">
          <div className="flex items-center gap-4">
            <span><div className="indicator mr-2" style={{ backgroundColor: 'var(--accent-blue)' }}></div> Sentinel-2 / Landsat Constellation Pass</span>
            <span className="text-gray-dim">10m GSD</span>
          </div>

          {/* MODE TOGGLE SWITCH */}
          <div className="flex items-center bg-black/60 p-1 rounded-lg border border-white/10 gap-1 font-sans">
            <button 
              className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${mode === 'explorer' ? 'bg-accent-blue text-black font-bold shadow-lg' : 'text-gray hover:text-white'}`}
              onClick={() => handleModeChange('explorer')}
            >
              <Compass size={13} /> Explorer
            </button>
            <button 
              className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${mode === 'expert' ? 'bg-accent-blue text-black font-bold shadow-lg' : 'text-gray hover:text-white'}`}
              onClick={() => handleModeChange('expert')}
            >
              <Cpu size={13} /> Expert
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span>LAT: {markerCoords.lat.toFixed(4)}°</span>
            <span>LON: {markerCoords.lng.toFixed(4)}°</span>
          </div>
        </div>

        {/* MAP CONTROLS */}
        <div className="map-controls">
          <button className="control-btn glass-panel" onClick={() => mapInstance?.zoomIn()}><Plus size={18} /></button>
          <button className="control-btn glass-panel" onClick={() => mapInstance?.zoomOut()}><Minus size={18} /></button>
          <button className="control-btn glass-panel mt-2" onClick={() => mapInstance?.flyTo({center: [initialCoords.lng, initialCoords.lat]})}><Crosshair size={18} /></button>
        </div>

        {/* BOTTOM QUERY / RESULT CENTER */}
        <div className="ask-bottom-center">
          <AnimatePresence mode="wait">
            {flowState === 'idle' && (
              <motion.div 
                key="query-input"
                className={`query-composer glass-panel ${isDragging ? 'drag-active' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragging && (
                  <div className="drop-overlay">
                    <Upload size={24} className="animate-bounce" /> Drop GeoTIFF / TIFF File Here
                  </div>
                )}

                {/* SELECTED LOCATION CONTEXT CHIP */}
                {selectedLocation && (
                  <div className="selected-location-chip flex items-center justify-between bg-black/60 px-3 py-1.5 rounded-lg border border-accent-blue/30 mb-2.5 text-xs font-mono">
                    <div className="flex items-center gap-2 text-white truncate">
                      <span className="flex items-center gap-1 text-accent-blue font-bold">
                        <MapPin size={13} /> {selectedLocation.lat.toFixed(4)}° N, {(selectedLocation.lon || selectedLocation.lng).toFixed(4)}° E
                      </span>
                      <span className="text-gray-dim">•</span>
                      <span className="text-gray flex items-center gap-1"><Sparkles size={11} className="text-accent-blue" /> {dataset}</span>
                      <span className="text-gray-dim">•</span>
                      <span className="text-gray">{selectedDate}</span>
                    </div>
                    <button 
                      type="button"
                      className="text-gray hover:text-white p-0.5 ml-2" 
                      onClick={() => setSelectedLocation(null)}
                      title="Clear selected location context"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* ATTACHED FILE CARD */}
                {attachmentMeta && (
                  <div className="attached-file-badge">
                    {attachmentMeta.previewUrl ? (
                      <img src={attachmentMeta.previewUrl} alt="GeoTIFF preview" className="attachment-thumb" />
                    ) : (
                      <div className="attachment-icon-fallback">TIFF</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate text-xs">{attachmentMeta.filename}</div>
                      <div className="text-[10px] text-gray-dim flex items-center gap-2">
                        <span>{attachmentMeta.sizeMb} MB</span>
                        <span>•</span>
                        <span>{attachmentMeta.dimensions || '4 Bands'}</span>
                        <span>•</span>
                        <span className="text-accent-blue font-bold">{attachmentMeta.isGeoreferenced !== false ? 'GeoTIFF' : 'TIFF (No CRS)'}</span>
                      </div>
                    </div>
                    <button type="button" onClick={clearAttachment} className="text-gray hover:text-white p-1" title="Remove attachment">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* ATTACHMENT PROGRESS / ERROR STATUS */}
                {attachmentState === 'VALIDATING' && <div className="text-xs text-accent-blue animate-pulse mb-1 font-mono">Checking TIFF header...</div>}
                {attachmentState === 'PROCESSING' && <div className="text-xs text-accent-blue animate-pulse mb-1 font-mono">Reading raster metadata & preview...</div>}
                {attachmentState === 'UPLOADING' && <div className="text-xs text-accent-blue animate-pulse mb-1 font-mono">Uploading GeoTIFF file...</div>}
                {attachmentError && <div className="text-xs text-warning-amber mb-1 font-mono">{attachmentError}</div>}

                <form onSubmit={handleQuerySubmit} className="query-form">
                  <label htmlFor="geotiff-upload-input" className="attach-btn" title="Upload GeoTIFF / TIFF file">
                    <Paperclip size={18} />
                  </label>
                  <input 
                    id="geotiff-upload-input"
                    type="file" 
                    accept=".tif,.tiff,.geotiff" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} 
                  />

                  <Search size={20} className="text-accent-blue" />
                  <input 
                    type="text" 
                    placeholder={attachmentMeta ? "Ask about this uploaded image..." : "What changed here over the last 14 days?"} 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="query-input"
                    autoFocus
                  />
                  <button type="submit" className="btn-primary ask-submit-btn" disabled={(!query.trim() && !attachmentMeta) || attachmentState === 'UPLOADING' || attachmentState === 'PROCESSING'}>
                    Ask <ArrowUp size={16} className="ml-1" />
                  </button>
                </form>

                <div className="text-[10px] text-gray-dim mt-1.5 text-center font-mono">Supported: GeoTIFF / TIFF (.tif, .tiff)</div>

                <div className="suggested-prompts">
                  <button type="button" className="prompt-pill" onClick={() => handleQuickPrompt('What changed here?')}>What changed here?</button>
                  <button type="button" className="prompt-pill" onClick={() => handleQuickPrompt('Find water expansion')}>Find water expansion</button>
                  <button type="button" className="prompt-pill" onClick={() => handleQuickPrompt('Check vegetation health')}>Check vegetation health</button>
                  <button type="button" className="prompt-pill" onClick={() => handleQuickPrompt('Detect new infrastructure')}>Detect new infrastructure</button>
                </div>
              </motion.div>
            )}

            {flowState !== 'idle' && flowState !== 'ready' && (
              <motion.div 
                key="loading-state"
                className="analysis-progress glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="progress-steps text-xs font-mono">
                  <div className={`step ${flowState === 'understanding' ? 'active' : 'complete'}`}>
                    {flowState === 'understanding' ? <CircleDashed size={14} className="animate-spin text-accent-blue" /> : <CheckCircle2 size={14} className="text-success-mint" />}
                    Understanding
                  </div>
                  <div className="step-divider">/</div>
                  <div className={`step ${flowState === 'analysing' ? 'active' : flowState === 'understanding' ? 'pending' : 'complete'}`}>
                    {flowState === 'analysing' ? <CircleDashed size={14} className="animate-spin text-accent-blue" /> : flowState === 'understanding' ? <CircleDashed size={14} className="text-gray-dim" /> : <CheckCircle2 size={14} className="text-success-mint" />}
                    Analysing
                  </div>
                  <div className="step-divider">/</div>
                  <div className={`step ${flowState === 'verifying' ? 'active' : flowState === 'ready' ? 'complete' : 'pending'}`}>
                    {flowState === 'verifying' ? <CircleDashed size={14} className="animate-spin text-accent-blue" /> : flowState === 'ready' ? <CheckCircle2 size={14} className="text-success-mint" /> : <CircleDashed size={14} className="text-gray-dim" />}
                    Verifying
                  </div>
                  <div className="step-divider">/</div>
                  <div className={`step ${flowState === 'ready' ? 'active' : 'pending'}`}>
                    {flowState === 'ready' ? <div className="indicator bg-accent-blue"></div> : <div className="indicator bg-gray-dim"></div>}
                    Ready
                  </div>
                </div>
              </motion.div>
            )}

            {flowState === 'ready' && result?.status === 'VERIFIED' && activeView && (
              <motion.div 
                key="result-panel"
                className="result-panel glass-panel overflow-y-auto max-h-[75vh]"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                {/* MODE BANNER */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={20} className="text-accent-blue" />
                    <h3 className="text-base font-bold tracking-wide">{activeView.title || result.title}</h3>
                  </div>
                  
                  {/* INLINE MODE TOGGLE */}
                  <div className="flex items-center bg-black/60 p-0.5 rounded border border-white/10 gap-1">
                    <button 
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all ${mode === 'explorer' ? 'bg-accent-blue text-black font-bold' : 'text-gray hover:text-white'}`}
                      onClick={() => handleModeChange('explorer')}
                    >
                      Explorer
                    </button>
                    <button 
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all ${mode === 'expert' ? 'bg-accent-blue text-black font-bold' : 'text-gray hover:text-white'}`}
                      onClick={() => handleModeChange('expert')}
                    >
                      Expert
                    </button>
                  </div>
                </div>

                {/* EXPLORER MODE CARD LAYOUT */}
                {mode === 'explorer' ? (
                  <div className="space-y-4">
                    {/* WHAT I FOUND */}
                    <div>
                      <div className="text-xs font-mono text-accent-blue uppercase tracking-wider mb-1 font-bold">WHAT I FOUND</div>
                      <p className="text-sm text-white font-medium leading-relaxed bg-accent-blue/5 p-3 rounded border border-accent-blue/20">
                        {activeView.summary}
                      </p>
                    </div>

                    {/* WHAT CHANGED */}
                    {activeView.whatChanged && (
                      <div>
                        <div className="text-xs font-mono text-gray-dim uppercase tracking-wider mb-1">WHAT CHANGED?</div>
                        <p className="text-xs text-gray leading-relaxed">{activeView.whatChanged}</p>
                      </div>
                    )}

                    {/* WHERE */}
                    {activeView.where && (
                      <div>
                        <div className="text-xs font-mono text-gray-dim uppercase tracking-wider mb-1">WHERE?</div>
                        <p className="text-xs text-gray leading-relaxed">{activeView.where}</p>
                      </div>
                    )}

                    {/* HOW MUCH */}
                    {activeView.howMuch && (
                      <div>
                        <div className="text-xs font-mono text-gray-dim uppercase tracking-wider mb-2">HOW MUCH?</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                          {typeof activeView.howMuch === 'object' ? (
                            Object.entries(activeView.howMuch).map(([k, v]) => (
                              <div key={k} className="bg-black/40 p-2.5 rounded border border-white/10 text-center">
                                <div className="text-[10px] font-mono text-gray-dim uppercase mb-0.5">{formatMetricLabel(k)}</div>
                                <div className="text-sm font-bold text-white">{v}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-white font-bold">{activeView.howMuch}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* WHAT DOES THIS MEAN? */}
                    {activeView.meaning && (
                      <div className="bg-black/30 p-3 rounded border border-white/5">
                        <div className="text-xs font-mono text-success-mint font-bold uppercase mb-1">WHAT DOES THIS MEAN?</div>
                        <p className="text-xs text-gray leading-relaxed">{activeView.meaning}</p>
                      </div>
                    )}

                    {/* WHAT WE CAN'T TELL FOR SURE */}
                    {activeView.whatWeCantTell && (
                      <div className="bg-black/30 p-3 rounded border border-white/5">
                        <div className="text-xs font-mono text-warning font-bold uppercase mb-1">WHAT WE CAN'T TELL FOR SURE</div>
                        <p className="text-xs text-gray leading-relaxed">{activeView.whatWeCantTell}</p>
                      </div>
                    )}

                    {/* SHOW TECHNICAL DETAILS EXPANDABLE */}
                    <div className="pt-1">
                      <button 
                        className="text-xs font-mono text-accent-blue hover:underline flex items-center gap-1"
                        onClick={() => setShowTechDetails(!showTechDetails)}
                      >
                        {showTechDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 
                        {showTechDetails ? 'Hide Technical Details' : 'Show Technical Details'}
                      </button>

                      {showTechDetails && result.metrics && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-2 p-3 bg-black/50 rounded border border-white/10 font-mono text-xs space-y-1"
                        >
                          <div className="text-gray-dim font-bold mb-1">RAW SATELLITE METRICS:</div>
                          {Object.entries(result.metrics).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-gray-dim">{formatMetricLabel(k)}:</span>
                              <span className="text-white">{v}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>

                    {/* EDUCATIONAL LEARN MORE ACCORDIONS */}
                    {activeView.learnMore && activeView.learnMore.length > 0 && (
                      <div className="pt-2 border-t border-white/10">
                        <div className="text-xs font-mono text-gray-dim uppercase tracking-wider mb-2 flex items-center gap-1">
                          <BookOpen size={13} className="text-accent-blue" /> LEARN AS YOU EXPLORE
                        </div>
                        <div className="space-y-1.5">
                          {activeView.learnMore.map((item, idx) => (
                            <div key={idx} className="bg-black/30 rounded border border-white/5 text-xs">
                              <button 
                                className="w-full text-left p-2 font-medium flex items-center justify-between text-gray hover:text-white"
                                onClick={() => setExpandedLearnItem(expandedLearnItem === idx ? null : idx)}
                              >
                                <span className="flex items-center gap-1.5"><HelpIcon size={12} className="text-accent-blue" /> {item.term}</span>
                                {expandedLearnItem === idx ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                              {expandedLearnItem === idx && (
                                <div className="px-2.5 pb-2 text.gray-dim text-[11px] leading-relaxed border-t border-white/5 pt-1.5">
                                  {item.explanation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* EXPERT MODE CARD LAYOUT */
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-mono text-accent-blue uppercase tracking-wider mb-1 font-bold">SUMMARY</div>
                      <p className="text-sm text-white font-medium leading-relaxed bg-black/40 p-3 rounded border border-white/10">
                        {activeView.summary}
                      </p>
                    </div>

                    {activeView.technicalFinding && (
                      <div>
                        <div className="text-xs font-mono text-gray-dim uppercase tracking-wider mb-1">TECHNICAL FINDING</div>
                        <p className="text-xs text-gray font-mono leading-relaxed bg-black/30 p-2.5 rounded border border-white/5">{activeView.technicalFinding}</p>
                      </div>
                    )}

                    {activeView.spatialDistribution && (
                      <div>
                        <div className="text-xs font-mono text-gray-dim uppercase tracking-wider mb-1">SPATIAL DISTRIBUTION</div>
                        <p className="text-xs text-gray leading-relaxed">{activeView.spatialDistribution}</p>
                      </div>
                    )}

                    {activeView.metrics && (
                      <div>
                        <div className="text-xs font-mono text-gray-dim uppercase tracking-wider mb-1">METRICS & INDEX DELTAS</div>
                        <div className="font-mono bg-black/50 p-3 rounded border border-white/10 text-xs space-y-1">
                          {Object.entries(activeView.metrics).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-gray-dim">{formatMetricLabel(k)}:</span>
                              <span className="text-white font-semibold">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeView.methodology && (
                      <div>
                        <div className="text-xs font-mono text-gray-dim uppercase tracking-wider mb-1">METHODOLOGY</div>
                        <p className="text-xs text-gray leading-relaxed">{activeView.methodology}</p>
                      </div>
                    )}

                    <div className="space-y-2 bg-black/30 p-3 rounded border border-white/5 text-xs">
                      {activeView.directlyObserved && (
                        <div>
                          <span className="font-mono text-accent-blue font-bold uppercase mr-2">DIRECTLY OBSERVED:</span>
                          <span className="text-gray">{activeView.directlyObserved}</span>
                        </div>
                      )}
                      {activeView.supportedInterpretation && (
                        <div>
                          <span className="font-mono text-success-mint font-bold uppercase mr-2">SUPPORTED INTERPRETATION:</span>
                          <span className="text-gray">{activeView.supportedInterpretation}</span>
                        </div>
                      )}
                      {activeView.uncertainty && (
                        <div>
                          <span className="font-mono text-warning font-bold uppercase mr-2">UNCERTAINTY:</span>
                          <span className="text-gray">{activeView.uncertainty}</span>
                        </div>
                      )}
                    </div>

                    {activeView.datasetAndSensor && (
                      <div className="text-xs font-mono text-gray-dim border-t border-white/10 pt-2">
                        {activeView.datasetAndSensor}
                      </div>
                    )}
                  </div>
                )}

                {/* ACTION BUTTONS & FOLLOW-UP PILLS */}
                <div className="result-actions mt-5 flex flex-col gap-3 border-t border-white/10 pt-4">
                  <div className="flex gap-3">
                    <button className="btn-primary flex-1 justify-center py-2.5 text-xs font-bold" onClick={() => setShowEvidence(true)}>
                      View Detailed Evidence <ArrowUp size={14} className="ml-1 rotate-45" />
                    </button>
                    {result?.overlayCoordinates ? (
                      <button className="btn-secondary flex-1 justify-center py-2.5 text-xs font-bold text-accent-blue" onClick={overlayRasterOnMap}>
                        <Layers size={14} className="mr-1.5" /> Overlay Image on Map
                      </button>
                    ) : (
                      <button className="btn-secondary flex-1 justify-center py-2.5 text-xs font-bold" onClick={highlightMapResult}>
                        <MapIcon size={14} className="mr-1.5 text-gray" /> Show on Map
                      </button>
                    )}
                    <button className="btn-secondary py-2.5 px-3 text-xs" onClick={resetFlow}>
                      New Query
                    </button>
                  </div>

                  {/* FOLLOW-UP QUERY SUGGESTIONS */}
                  {activeView.actions && activeView.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="text-xs font-mono text-gray-dim self-center mr-1">Explore further:</span>
                      {activeView.actions.map((act, idx) => (
                        act.action === 'overlay_raster' ? (
                          <button key={idx} className="prompt-pill text-xs py-1 px-2.5 bg-accent-blue/10 border-accent-blue/30 text-accent-blue font-bold" onClick={overlayRasterOnMap}>
                            {act.label}
                          </button>
                        ) : act.query ? (
                          <button 
                            key={idx} 
                            className="prompt-pill text-xs py-1 px-2.5" 
                            onClick={() => executeAskQuery(act.query)}
                          >
                            {act.label}
                          </button>
                        ) : null
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {flowState === 'ready' && (result?.status === 'INSUFFICIENT_DATA' || result?.status === 'UNSUPPORTED' || result?.status === 'ERROR') && (
              <motion.div 
                key="abstention-panel"
                className="result-panel glass-panel border-warning"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
              >
                <div className="result-header flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} className="text-warning" />
                  <h3 className="text-sm font-bold text-warning">{result.title || 'Analysis Limit'}</h3>
                </div>
                <p className="text-sm text-gray leading-relaxed mb-4">{result.answer || result.summary}</p>
                <div className="result-actions flex gap-3">
                  <button className="btn-secondary flex-1 py-2 text-xs font-bold" onClick={resetFlow}>Ask Another Question</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* EVIDENCE DRAWER */}
        <AnimatePresence>
          {showEvidence && result && (
            <motion.div 
              className="evidence-drawer glass-panel"
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
            >
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                <h3 className="text-sm font-bold tracking-wider">VERIFIED SATELLITE EVIDENCE</h3>
                <button onClick={() => setShowEvidence(false)} className="text-gray hover:text-white"><X size={18} /></button>
              </div>
              
              <div className="space-y-5 text-xs">
                <div>
                  <div className="text-gray-dim font-mono mb-1 uppercase">DATASET & SENSOR</div>
                  <div className="font-semibold text-accent-blue text-sm">{result.sources?.[0]?.name || 'Sentinel-2 MSI Harmonized'}</div>
                  <div className="text-gray-dim text-[11px] mt-0.5">10m GSD · Multispectral Constellation</div>
                </div>

                <div>
                  <div className="text-gray-dim font-mono mb-1 uppercase">OBSERVATION WINDOW</div>
                  <div className="font-mono bg-black/40 p-2.5 rounded border border-white/10 flex justify-between">
                    <div><span className="text-gray-dim">Baseline:</span> {result.timeRange?.start}</div>
                    <div><span className="text-gray-dim">Target:</span> {result.timeRange?.end}</div>
                  </div>
                </div>

                <div>
                  <div className="text-gray-dim font-mono mb-1 uppercase">ANALYSIS METHOD</div>
                  <div className="font-semibold text-white">{result.analysisType}</div>
                </div>

                {result.observedVsInterpreted && (
                  <div className="space-y-3">
                    <div className="bg-black/30 p-2.5 rounded border border-white/5">
                      <div className="font-mono text-accent-blue mb-1 font-bold">DIRECTLY OBSERVED:</div>
                      <div className="text-gray leading-relaxed">{result.observedVsInterpreted.observed}</div>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded border border-white/5">
                      <div className="font-mono text-success-mint mb-1 font-bold">SUPPORTED INTERPRETATION:</div>
                      <div className="text-gray leading-relaxed">{result.observedVsInterpreted.interpreted}</div>
                    </div>
                    <div className="bg-black/30 p-2.5 rounded border border-white/5">
                      <div className="font-mono text-warning mb-1 font-bold">UNCERTAIN / UNPROVEN:</div>
                      <div className="text-gray leading-relaxed">{result.observedVsInterpreted.uncertain}</div>
                    </div>
                  </div>
                )}

                {result.metrics && (
                  <div>
                    <div className="text-gray-dim font-mono mb-1 uppercase">RAW CALCULATED METRICS</div>
                    <div className="font-mono bg-black/40 p-3 rounded text-xs border border-white/10 space-y-1.5">
                      {Object.entries(result.metrics).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-gray-dim">{formatMetricLabel(k)}:</span>
                          <span className="text-white font-semibold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.limitations && result.limitations.length > 0 && (
                  <div>
                    <div className="text-gray-dim font-mono mb-1 uppercase">DATA LIMITATIONS</div>
                    <ul className="list-disc list-inside text-gray space-y-1 pl-1">
                      {result.limitations.map((lim, idx) => (
                        <li key={idx}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </MapViewport>
    </div>
  );
}
