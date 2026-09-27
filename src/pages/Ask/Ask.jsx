import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowUp, X, Activity, CheckCircle2, CircleDashed, ChevronRight, HelpCircle, Map as MapIcon, Minus, Plus, Crosshair, Navigation } from 'lucide-react';
import AppNavigation from '../../components/AppNavigation';
import MapViewport from '../../components/MapViewport';
import './Ask.css';

export default function Ask() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  
  // Inherit context from Explore if available
  const initialCoords = routerLocation.state?.coords || { lng: 72.5714, lat: 23.0225 };
  
  const [hoverCoords, setHoverCoords] = useState(null);
  const [markerCoords, setMarkerCoords] = useState(initialCoords);
  const [query, setQuery] = useState('');
  
  const [flowState, setFlowState] = useState('idle'); // idle, understanding, analysing, verifying, ready, error
  const [result, setResult] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);

  // Map Controls
  const [mapInstance, setMapInstance] = useState(null);

  const handleQuerySubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setFlowState('understanding');
    
    // Demonstrate Abstention if user types "unsupported"
    if (query.toLowerCase().includes('unsupported')) {
      setTimeout(() => {
        setFlowState('ready');
        setResult({
          type: 'abstention',
          title: 'Insufficient Evidence',
          description: 'This imagery cannot reliably answer that question due to high cloud cover in the requested timeframe.',
          actions: ['Choose another date', 'Choose another dataset']
        });
      }, 1500);
      return;
    }

    setTimeout(() => setFlowState('analysing'), 1000);
    setTimeout(() => setFlowState('verifying'), 2000);
    setTimeout(() => {
      setFlowState('ready');
      setResult({
        type: 'success',
        title: 'Surface Water Expansion Detected',
        confidence: '96.8%',
        description: 'Significant hydrological surface increase identified across the delta estuary following seasonal rainfall over the monitored window.',
        area: '12.8',
        change: '+21.7%',
        analysis: 'NDWI'
      });
      
      // Update map to show result
      if (mapInstance) {
        mapInstance.flyTo({
          center: [initialCoords.lng, initialCoords.lat],
          zoom: 13,
          duration: 2000
        });
      }
    }, 3000);
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
  };

  return (
    <div className="ask-container">
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
        <div className="ask-top-bar glass-panel text-xs font-mono text-gray">
          <div className="flex items-center gap-4">
            <span><div className="indicator mr-2" style={{ backgroundColor: 'var(--accent-blue)' }}></div> Delta Estuary Sensor Pass</span>
            <span className="text-gray-dim">10m GSD</span>
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
                className="query-composer glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <form onSubmit={handleQuerySubmit} className="query-form">
                  <Search size={20} className="text-accent-blue" />
                  <input 
                    type="text" 
                    placeholder="What changed here over the last 14 days?" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="query-input"
                    autoFocus
                  />
                  <button type="submit" className="btn-primary ask-submit-btn" disabled={!query.trim()}>
                    Ask <ArrowUp size={16} className="ml-1" />
                  </button>
                </form>

                <div className="suggested-prompts">
                  <button type="button" className="prompt-pill" onClick={() => setQuery('What changed here?')}>What changed here?</button>
                  <button type="button" className="prompt-pill" onClick={() => setQuery('Find water expansion')}>Find water expansion</button>
                  <button type="button" className="prompt-pill" onClick={() => setQuery('Check vegetation health')}>Check vegetation health</button>
                  <button type="button" className="prompt-pill" onClick={() => setQuery('Detect new infrastructure')}>Detect new infrastructure</button>
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

            {flowState === 'ready' && result?.type === 'success' && (
              <motion.div 
                key="result-panel"
                className="result-panel glass-panel"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className="result-header">
                  <div className="flex items-center gap-2">
                    <div className="indicator bg-accent-blue"></div>
                    <h3 className="text-sm font-bold">{result.title}</h3>
                  </div>
                  <div className="confidence-badge text-xs font-mono">{result.confidence} Confidence</div>
                </div>
                
                <p className="text-sm text-gray mt-4 leading-relaxed">
                  {result.description}
                </p>
                
                <div className="result-metrics mt-6">
                  <div className="metric-box">
                    <div className="text-xs font-mono text-gray-dim mb-1 uppercase tracking-wider">Affected Area</div>
                    <div className="text-2xl font-bold">{result.area} <span className="text-sm font-normal text-gray">km²</span></div>
                    <div className="text-xs text-gray-dim mt-1">≈ +2.7 km² shoreline</div>
                  </div>
                  <div className="metric-box">
                    <div className="text-xs font-mono text-gray-dim mb-1 uppercase tracking-wider">Change Magnitude</div>
                    <div className="text-2xl font-bold text-success-mint">{result.change}</div>
                    <div className="text-xs text-gray-dim mt-1">vs 30-day baseline mean</div>
                  </div>
                </div>

                <div className="router-explanation mt-4 text-xs font-mono text-gray flex items-center gap-1">
                  <ChevronRight size={14} /> Analysis: {result.analysis} · <button className="underline hover:text-white transition-colors">Why this analysis?</button>
                </div>

                <div className="result-actions mt-6 flex gap-3">
                  <button className="btn-primary flex-1 justify-center py-3" onClick={() => setShowEvidence(true)}>
                    View Evidence <ArrowUp size={16} className="ml-1 rotate-45" />
                  </button>
                  <button className="btn-secondary flex-1 justify-center py-3" onClick={resetFlow}>
                    <MapIcon size={16} className="mr-2 text-gray" /> View on Map
                  </button>
                </div>
              </motion.div>
            )}

            {flowState === 'ready' && result?.type === 'abstention' && (
              <motion.div 
                key="abstention-panel"
                className="result-panel glass-panel border-warning"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
              >
                <div className="result-header">
                  <div className="flex items-center gap-2">
                    <div className="indicator bg-warning"></div>
                    <h3 className="text-sm font-bold text-warning">{result.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-gray mt-4">{result.description}</p>
                <div className="result-actions mt-6 flex gap-3">
                  {result.actions.map(action => (
                    <button key={action} className="btn-secondary flex-1 py-2 text-xs" onClick={resetFlow}>{action}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* EVIDENCE DRAWER */}
        <AnimatePresence>
          {showEvidence && (
            <motion.div 
              className="evidence-drawer glass-panel"
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold">ANALYSIS EVIDENCE</h3>
                <button onClick={() => setShowEvidence(false)} className="text-gray hover:text-white"><X size={18} /></button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-xs text-gray-dim font-mono mb-1">DATASET</div>
                  <div>Sentinel-2 Harmonized</div>
                </div>
                <div>
                  <div className="text-xs text-gray-dim font-mono mb-1">METHOD</div>
                  <div>NDWI Differential thresholding</div>
                </div>
                <div>
                  <div className="text-xs text-gray-dim font-mono mb-1">RAW VALUES</div>
                  <div className="font-mono bg-black/30 p-2 rounded text-xs mt-1">
                    mean_pre: 0.12<br/>
                    mean_post: 0.45<br/>
                    diff: +0.33
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </MapViewport>
    </div>
  );
}
