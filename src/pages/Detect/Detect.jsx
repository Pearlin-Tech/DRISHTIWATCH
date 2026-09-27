import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplet, Leaf, Building2, HardHat, Navigation, Flame, 
  Square, Hexagon, CircleDashed, CheckCircle2, Download, Focus, Eye, X
} from 'lucide-react';
import AppNavigation from '../../components/AppNavigation';
import MapViewport from '../../components/MapViewport';
import './Detect.css';

export default function Detect() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  
  const initialCoords = routerLocation.state?.coords || { lng: 72.5714, lat: 23.0225 };
  
  const [hoverCoords, setHoverCoords] = useState(null);
  const [markerCoords, setMarkerCoords] = useState(initialCoords);
  const [mapInstance, setMapInstance] = useState(null);

  const targets = [
    { id: 'water', label: 'Water', icon: Droplet },
    { id: 'vegetation', label: 'Vegetation', icon: Leaf },
    { id: 'buildings', label: 'Buildings', icon: Building2 },
    { id: 'construction', label: 'Construction', icon: HardHat },
    { id: 'roads', label: 'Roads', icon: Navigation },
    { id: 'burn', label: 'Burn Areas', icon: Flame },
  ];

  const [activeTarget, setActiveTarget] = useState('water');
  const [selectionMode, setSelectionMode] = useState('box');
  const [detectionState, setDetectionState] = useState('idle'); // idle, scanning, analysing, ready
  const [maskVisible, setMaskVisible] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);

  const mockResults = [
    { id: 1, name: 'Primary Delta Estuary', area: '11.2', status: 'Confirmed', change: '+14% vs baseline' },
    { id: 2, name: 'Northern Tidal Basin', area: '4.8', status: 'Confirmed', change: '+6% vs baseline' },
    { id: 3, name: 'Inshore Runoff Channel', area: '2.4', status: 'Flagged', change: 'New emergence' }
  ];

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCurrent, setDrawCurrent] = useState(null);
  const [drawnBox, setDrawnBox] = useState(null);

  const startDrawingMode = () => {
    setIsDrawing(true);
    setDrawnBox(null);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const handlePointerDown = (e) => {
    if (!isDrawing) return;
    setDrawStart({ x: e.clientX, y: e.clientY });
    setDrawCurrent({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !drawStart) return;
    setDrawCurrent({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) return;
    
    // Calculate final box properties as percentages for responsive overlay
    const left = Math.min(drawStart.x, drawCurrent.x);
    const top = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);
    
    if (width > 20 && height > 20) {
      setDrawnBox({ 
        left: `${(left / window.innerWidth) * 100}%`, 
        top: `${(top / window.innerHeight) * 100}%`, 
        width: `${(width / window.innerWidth) * 100}%`, 
        height: `${(height / window.innerHeight) * 100}%` 
      });
      setIsDrawing(false);
      handleRunDetection();
    } else {
      setDrawStart(null);
      setDrawCurrent(null);
    }
  };

  const handleRunDetection = () => {
    setDetectionState('scanning');
    setTimeout(() => setDetectionState('analysing'), 1000);
    setTimeout(() => setDetectionState('ready'), 2500);
  };

  const handleClear = () => {
    setDetectionState('idle');
    setSelectedResult(null);
  };

  return (
    <div className="detect-container">
      <AppNavigation />
      
      <MapViewport 
        center={[initialCoords.lng, initialCoords.lat]} 
        zoom={13}
        hoverCoords={hoverCoords}
        setHoverCoords={setHoverCoords}
        markerCoords={markerCoords}
        onMapClick={(coords) => setMarkerCoords(coords)}
        onMapLoad={setMapInstance}
      >
        
        {/* TOP STATUS BAR */}
        <div className="detect-top-bar glass-panel text-xs font-mono text-gray">
          <div className="flex items-center gap-4">
            <span><div className="indicator mr-2 bg-success-mint"></div> SAMPLE DATA · SENTINEL-2</span>
          </div>
          <div className="flex items-center gap-4">
            <span>LAT: {markerCoords.lat.toFixed(4)}°</span>
            <span>LON: {markerCoords.lng.toFixed(4)}°</span>
            <span className="text-gray-dim">8.5M/PX</span>
          </div>
        </div>

        {/* DETECT TARGET SELECTOR */}
        <div className="detect-toolbar glass-panel">
          <div className="toolbar-header">
            <span className="text-gray text-xs">Detect Workflow</span>
            <h2 className="text-white text-sm font-medium">What are you looking for?</h2>
          </div>
          
          <div className="target-selector">
            {targets.map(t => (
              <button 
                key={t.id}
                className={`target-btn ${activeTarget === t.id ? 'active' : ''}`}
                onClick={() => setActiveTarget(t.id)}
              >
                <t.icon size={16} className={activeTarget === t.id ? 'text-white' : 'text-gray'} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="toolbar-divider"></div>

          <div className="selection-mode">
            <button 
              className={`mode-btn ${selectionMode === 'box' ? 'active' : ''}`}
              onClick={() => setSelectionMode('box')}
            >
              <Square size={14} /> Box
            </button>
            <button 
              className={`mode-btn ${selectionMode === 'polygon' ? 'active' : ''}`}
              onClick={() => setSelectionMode('polygon')}
            >
              <Hexagon size={14} /> Polygon
            </button>
          </div>

          {detectionState === 'idle' && !isDrawing && (
            <button className="btn-primary ml-auto text-xs py-1.5 px-3" onClick={startDrawingMode}>
              Select Area on Map
            </button>
          )}
          {isDrawing && (
            <div className="ml-auto text-xs py-1.5 px-3 text-warning animate-pulse flex items-center gap-2">
              <Square size={14} /> Draw box on map
            </div>
          )}
        </div>

        {/* DRAWING OVERLAY */}
        {isDrawing && (
          <div 
            className="drawing-overlay" 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, cursor: 'crosshair' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {drawStart && drawCurrent && (
              <div 
                className="drawing-box"
                style={{
                  position: 'absolute',
                  border: '2px dashed var(--accent-blue)',
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  left: Math.min(drawStart.x, drawCurrent.x),
                  top: Math.min(drawStart.y, drawCurrent.y),
                  width: Math.abs(drawCurrent.x - drawStart.x),
                  height: Math.abs(drawCurrent.y - drawStart.y)
                }}
              />
            )}
          </div>
        )}

        {/* MOCK DETECTION REGION ON MAP */}
        <AnimatePresence>
          {detectionState === 'ready' && maskVisible && drawnBox && (
            <motion.div 
              className="mock-detection-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mock-bounding-box" style={{ ...drawnBox }}>
                <div className="bb-header">
                  <div className="indicator bg-accent-blue"></div>
                  AOI-DETECTION // 3 Areas Identified <span className="text-gray-dim ml-2">18.4 km²</span>
                </div>
                
                {/* Mock polygons */}
                <div className={`mock-polygon p1 ${selectedResult === 1 ? 'selected' : ''}`} onClick={() => setSelectedResult(1)}>
                  <div className="polygon-label"><Droplet size={10} /> #01 Delta Estuary (98.6%)</div>
                </div>
                <div className={`mock-polygon p2 ${selectedResult === 2 ? 'selected' : ''}`} onClick={() => setSelectedResult(2)}></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM RESULT DRAWER */}
        <AnimatePresence>
          {detectionState !== 'idle' && (
            <motion.div 
              className="detection-results glass-panel"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {detectionState === 'scanning' || detectionState === 'analysing' ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CircleDashed size={24} className="animate-spin text-accent-blue mb-4" />
                  <div className="text-sm font-mono tracking-wider">
                    {detectionState === 'scanning' ? 'SCANNING SELECTED REGION...' : 'ANALYSING SIGNATURES...'}
                  </div>
                </div>
              ) : (
                <>
                  <div className="results-header">
                    <div className="flex items-center gap-2">
                      <div className="indicator bg-accent-blue"></div>
                      <h3 className="text-lg">3 water bodies detected across selected region</h3>
                      <span className="text-xs font-mono text-gray-dim ml-2">Confidence 98.2% · Total Area: 18.4 km²</span>
                    </div>
                    <button 
                      className="text-xs font-mono flex items-center gap-2 hover:text-white transition-colors"
                      onClick={() => setMaskVisible(!maskVisible)}
                    >
                      <Eye size={14} className={maskVisible ? 'text-accent-blue' : 'text-gray'} /> Toggle Mask
                    </button>
                  </div>

                  <div className="results-grid mt-4">
                    {mockResults.map((res) => (
                      <div 
                        key={res.id} 
                        className={`result-card ${selectedResult === res.id ? 'selected' : ''}`}
                        onClick={() => setSelectedResult(res.id)}
                      >
                        <div className="card-header">
                          <span className="text-xs font-mono text-gray-dim uppercase">Area {String(res.id).padStart(2, '0')}</span>
                          <span className={`status-pill ${res.status === 'Confirmed' ? 'success' : 'warning'}`}>
                            {res.status}
                          </span>
                        </div>
                        <h4 className="text-base mt-2">{res.name}</h4>
                        <div className="flex justify-between items-end mt-4">
                          <div className="text-xl font-bold">{res.area} <span className="text-xs font-normal text-gray">km²</span></div>
                          <div className="text-xs font-mono text-gray-dim flex items-center gap-1">
                            {res.change}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="results-footer mt-6 flex justify-between items-center border-t border-white/5 pt-4">
                    <button className="text-xs text-gray hover:text-white flex items-center gap-2 transition-colors" onClick={handleClear}>
                      <X size={14} /> Clear Selection
                    </button>
                    <div className="flex gap-2">
                      <button className="btn-secondary text-xs py-2 px-4 flex items-center gap-2">
                        <Download size={14} /> Export Polygons (.GeoJSON)
                      </button>
                      <button className="btn-primary text-xs py-2 px-4 flex items-center gap-2">
                        <Focus size={14} /> Focus Full AOI
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* CONTEXTUAL INSPECTOR FOR SELECTED DETECTION */}
        <AnimatePresence>
          {selectedResult && (
            <motion.div 
              className="detection-inspector glass-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold">Detection {String(selectedResult).padStart(2, '0')}</h3>
                <button onClick={() => setSelectedResult(null)} className="text-gray hover:text-white"><X size={16} /></button>
              </div>
              
              <div className="space-y-3 text-xs mb-6">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-dim font-mono">OBJECT</span>
                  <span>Water Body</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-dim font-mono">STATUS</span>
                  <span className="text-success-mint">Confirmed</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-dim font-mono">EVIDENCE</span>
                  <span className="underline cursor-pointer">NDWI Pass</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button 
                  className="btn-primary text-xs justify-center py-2"
                  onClick={() => navigate('/ask', { state: { coords: markerCoords, context: 'detect-handoff' } })}
                >
                  Ask about this
                </button>
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1 text-xs py-2">Watch</button>
                  <button className="btn-secondary flex-1 text-xs py-2" onClick={() => {
                    mapInstance?.flyTo({ center: [initialCoords.lng, initialCoords.lat], zoom: 15 });
                  }}>View</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </MapViewport>
    </div>
  );
}
