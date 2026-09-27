import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplet, Leaf, Building2, HardHat, Navigation, Flame, 
  Square, Hexagon, CircleDashed, CheckCircle2, Download, Focus, Eye, EyeOff, X, Search, AlertCircle
} from 'lucide-react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import DrawRectangle from 'mapbox-gl-draw-rectangle-mode';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import AppNavigation from '../../components/AppNavigation';
import MapViewport from '../../components/MapViewport';
import { detect, TARGET_REGISTRY, detectRouter } from '../../services/detectionService';
import './Detect.css';

const modes = MapboxDraw.modes;
modes.draw_rectangle = DrawRectangle;

export default function Detect() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  
  const initialCoords = routerLocation.state?.coords || { lng: 72.5714, lat: 23.0225 };
  
  const [hoverCoords, setHoverCoords] = useState(null);
  const [markerCoords, setMarkerCoords] = useState(initialCoords);
  const [mapInstance, setMapInstance] = useState(null);
  const drawInstanceRef = useRef(null);

  const targets = Object.values(TARGET_REGISTRY);

  const [activeTarget, setActiveTarget] = useState('water');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState('box');
  
  // State machine: idle, selecting, selected, processing, ready, error, empty, unsupported
  const [detectionState, setDetectionState] = useState('idle'); 
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [aoiGeometry, setAoiGeometry] = useState(null);
  const [detectionResult, setDetectionResult] = useState(null);
  
  const [maskVisible, setMaskVisible] = useState(true);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState(null);

  // Initialize Mapbox Draw
  useEffect(() => {
    if (mapInstance && !drawInstanceRef.current) {
      const draw = new MapboxDraw({
        modes: modes,
        displayControlsDefault: false,
        defaultMode: 'simple_select'
      });
      mapInstance.addControl(draw, 'top-left');
      
      // Hide the default control panel of Mapbox Draw via CSS, we only want the API
      
      drawInstanceRef.current = draw;
      
      mapInstance.on('draw.create', handleDrawComplete);
      mapInstance.on('draw.update', handleDrawComplete);
      mapInstance.on('draw.delete', () => {
        setAoiGeometry(null);
        if (detectionState === 'selected') setDetectionState('idle');
      });

      // Map interactions for detection results
      mapInstance.on('mousemove', 'detection-fill', (e) => {
        if (e.features.length > 0) {
          mapInstance.getCanvas().style.cursor = 'pointer';
          setHoveredFeatureId(e.features[0].properties.id);
        }
      });
      mapInstance.on('mouseleave', 'detection-fill', () => {
        mapInstance.getCanvas().style.cursor = '';
        setHoveredFeatureId(null);
      });
      mapInstance.on('click', 'detection-fill', (e) => {
        if (e.features.length > 0) {
          setSelectedFeatureId(e.features[0].properties.id);
          const bbox = calculateBBox(e.features[0].geometry);
          mapInstance.fitBounds(bbox, { padding: 150, maxZoom: 16 });
        }
      });
    }
  }, [mapInstance]);

  const handleDrawComplete = (e) => {
    if (e.features && e.features.length > 0) {
      // Get the latest feature drawn
      const feature = e.features[e.features.length - 1];
      
      // Remove other features to keep only one AOI
      const all = drawInstanceRef.current.getAll();
      all.features.forEach(f => {
        if (f.id !== feature.id) {
          drawInstanceRef.current.delete(f.id);
        }
      });
      
      setAoiGeometry(feature.geometry);
      setDetectionState('selected');
    }
  };

  const startDrawingMode = () => {
    if (!drawInstanceRef.current) return;
    
    // Clear previous
    drawInstanceRef.current.deleteAll();
    setAoiGeometry(null);
    setDetectionResult(null);
    removeDetectionLayers();
    
    setDetectionState('selecting');
    
    if (selectionMode === 'box') {
      drawInstanceRef.current.changeMode('draw_rectangle');
    } else {
      drawInstanceRef.current.changeMode('draw_polygon');
    }
  };

  const handleRunDetection = async () => {
    if (!aoiGeometry) return;
    
    setDetectionState('processing');
    setProcessingStatus('Preparing imagery...');
    setSelectedFeatureId(null);
    
    setTimeout(() => setProcessingStatus('Analyzing signatures...'), 800);
    setTimeout(() => setProcessingStatus('Vectorizing results...'), 1600);
    
    try {
      const request = {
        query: searchQuery,
        targetType: activeTarget,
        geometry: aoiGeometry,
        selectionMode: selectionMode,
        dataset: 'Sentinel-2',
        date: new Date().toISOString().split('T')[0]
      };
      
      const res = await detect(request);
      
      if (res.status === 'error') {
        if (res.error === 'UNSUPPORTED_TARGET') {
          setDetectionState('unsupported');
        } else {
          setDetectionState('error');
        }
        setErrorMsg(res.message);
        return;
      }
      
      setDetectionResult(res);
      setActiveTarget(res.targetType); // If mapped by search
      
      if (res.detections && res.detections.features && res.detections.features.length > 0) {
        setDetectionState('ready');
        updateDetectionLayers(res.detections, res.targetType);
      } else {
        setDetectionState('empty');
      }
    } catch (err) {
      setDetectionState('error');
      setErrorMsg('An unexpected error occurred during detection.');
    }
  };

  const calculateBBox = (geometry) => {
    let coords = [];
    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates[0];
    } else if (geometry.type === 'LineString') {
      coords = geometry.coordinates;
    } else {
      return [-180, -90, 180, 90];
    }
    
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    coords.forEach(c => {
      if (c[0] < minLng) minLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] > maxLat) maxLat = c[1];
    });
    return [minLng, minLat, maxLng, maxLat];
  };

  const removeDetectionLayers = () => {
    if (!mapInstance) return;
    if (mapInstance.getLayer('detection-fill')) mapInstance.removeLayer('detection-fill');
    if (mapInstance.getLayer('detection-outline')) mapInstance.removeLayer('detection-outline');
    if (mapInstance.getSource('detection-source')) mapInstance.removeSource('detection-source');
  };

  const updateDetectionLayers = (featureCollection, targetId) => {
    if (!mapInstance) return;
    removeDetectionLayers();
    
    const targetDef = TARGET_REGISTRY[targetId];
    const color = targetDef ? targetDef.color : '#3b82f6';
    
    mapInstance.addSource('detection-source', {
      type: 'geojson',
      data: featureCollection
    });
    
    mapInstance.addLayer({
      id: 'detection-fill',
      type: 'fill',
      source: 'detection-source',
      paint: {
        'fill-color': color,
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.5,
          ['boolean', ['feature-state', 'selected'], false],
          0.6,
          targetDef?.fillOpacity || 0.3
        ]
      },
      filter: ['==', '$type', 'Polygon']
    });
    
    mapInstance.addLayer({
      id: 'detection-outline',
      type: 'line',
      source: 'detection-source',
      paint: {
        'line-color': color,
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          3,
          1.5
        ]
      }
    });
  };

  // Sync hovered state with map features
  useEffect(() => {
    if (!mapInstance || !detectionResult || !detectionResult.detections) return;
    
    const sourceId = 'detection-source';
    if (!mapInstance.getSource(sourceId)) return;
    
    // Clear all feature states
    detectionResult.detections.features.forEach((f) => {
      mapInstance.setFeatureState({ source: sourceId, id: f.id }, { hover: false, selected: false });
    });
    
    if (hoveredFeatureId) {
      mapInstance.setFeatureState({ source: sourceId, id: hoveredFeatureId }, { hover: true });
    }
    if (selectedFeatureId) {
      mapInstance.setFeatureState({ source: sourceId, id: selectedFeatureId }, { selected: true });
    }
  }, [hoveredFeatureId, selectedFeatureId, detectionResult, mapInstance]);

  // Toggle mask visibility
  useEffect(() => {
    if (!mapInstance || !mapInstance.getLayer('detection-fill')) return;
    const visibility = maskVisible ? 'visible' : 'none';
    mapInstance.setLayoutProperty('detection-fill', 'visibility', visibility);
    mapInstance.setLayoutProperty('detection-outline', 'visibility', visibility);
  }, [maskVisible, mapInstance]);

  const handleClear = () => {
    if (drawInstanceRef.current) drawInstanceRef.current.deleteAll();
    removeDetectionLayers();
    setAoiGeometry(null);
    setDetectionResult(null);
    setSelectedFeatureId(null);
    setDetectionState('idle');
    setSearchQuery('');
  };

  const handleFocusAOI = () => {
    if (aoiGeometry && mapInstance) {
      const bbox = calculateBBox(aoiGeometry);
      mapInstance.fitBounds(bbox, { padding: 100 });
    }
  };

  const getTargetIcon = (id) => {
    if (id === 'water') return Droplet;
    if (id === 'vegetation') return Leaf;
    if (id === 'buildings') return Building2;
    if (id === 'construction') return HardHat;
    if (id === 'roads') return Navigation;
    if (id === 'burn') return Flame;
    return Search;
  };

  const TargetIcon = getTargetIcon(activeTarget);
  const selectedFeature = detectionResult?.detections?.features?.find(f => f.properties.id === selectedFeatureId);

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
            <span><div className="indicator mr-2 bg-success-mint"></div> LIVE DATA · SENTINEL-2</span>
          </div>
          <div className="flex items-center gap-4">
            <span>LAT: {markerCoords.lat.toFixed(4)}°</span>
            <span>LON: {markerCoords.lng.toFixed(4)}°</span>
            <span className="text-gray-dim">10M/PX</span>
          </div>
        </div>

        {/* DETECT TARGET SELECTOR */}
        <div className="detect-toolbar glass-panel">
          <div className="toolbar-header">
            <span className="text-gray text-xs">Detect Workspace</span>
            <h2 className="text-white text-sm font-medium">What are you looking for?</h2>
          </div>
          
          <div className="target-selector">
            <div className="search-target-wrapper mr-2 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
              <input 
                type="text" 
                className="bg-black/40 border border-white/10 rounded-full py-1.5 pl-8 pr-4 text-xs text-white placeholder:text-gray focus:outline-none focus:border-accent-blue transition-colors"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setActiveTarget('')}
              />
            </div>
            {targets.map(t => {
              const Icon = getTargetIcon(t.id);
              return (
                <button 
                  key={t.id}
                  className={`target-btn ${activeTarget === t.id && !searchQuery ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTarget(t.id);
                    setSearchQuery('');
                  }}
                  title={t.description}
                >
                  <Icon size={16} className={activeTarget === t.id && !searchQuery ? 'text-white' : 'text-gray'} />
                  {t.label}
                </button>
              )
            })}
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

          {['idle', 'selected', 'ready', 'empty', 'error', 'unsupported'].includes(detectionState) && (
            <button 
              className={`btn-primary ml-auto text-xs py-1.5 px-4 ${detectionState === 'selected' ? 'bg-success-mint hover:bg-success-mint/90 text-black font-bold' : ''}`}
              onClick={detectionState === 'selected' ? handleRunDetection : startDrawingMode}
            >
              {detectionState === 'selected' ? 'Run Detection' : 'Select Area on Map'}
            </button>
          )}
          
          {detectionState === 'selecting' && (
            <div className="ml-auto text-xs py-1.5 px-3 text-warning animate-pulse flex items-center gap-2">
              {selectionMode === 'box' ? <Square size={14} /> : <Hexagon size={14} />} 
              Draw {selectionMode} on map
            </div>
          )}
          {detectionState === 'processing' && (
            <div className="ml-auto text-xs py-1.5 px-3 text-accent-blue flex items-center gap-2">
              <CircleDashed size={14} className="animate-spin" /> {processingStatus}
            </div>
          )}
        </div>

        {/* BOTTOM DRAWER / STATE MESSAGES */}
        <AnimatePresence>
          {['processing', 'error', 'unsupported', 'empty', 'ready'].includes(detectionState) && (
            <motion.div 
              className="detection-results glass-panel"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              
              {/* STATES OTHER THAN READY */}
              {detectionState === 'processing' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <CircleDashed size={24} className="animate-spin text-accent-blue mb-4" />
                  <div className="text-sm font-mono tracking-wider text-accent-blue">{processingStatus.toUpperCase()}</div>
                </div>
              )}

              {detectionState === 'empty' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <EyeOff size={24} className="text-gray mb-4" />
                  <div className="text-sm font-bold mb-2">NO DETECTIONS FOUND</div>
                  <div className="text-xs text-gray max-w-md text-center">No target objects were identified in the selected region using the {TARGET_REGISTRY[activeTarget]?.label || 'specified'} workflow.</div>
                  <button className="btn-secondary mt-4 text-xs py-1.5 px-4" onClick={startDrawingMode}>Change Area</button>
                </div>
              )}

              {detectionState === 'error' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <AlertCircle size={24} className="text-danger mb-4" />
                  <div className="text-sm font-bold text-danger mb-2">DETECTION FAILED</div>
                  <div className="text-xs text-gray max-w-md text-center">{errorMsg}</div>
                  <button className="btn-secondary mt-4 text-xs py-1.5 px-4" onClick={handleRunDetection}>Retry Detection</button>
                </div>
              )}

              {detectionState === 'unsupported' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <AlertCircle size={24} className="text-warning mb-4" />
                  <div className="text-sm font-bold text-warning mb-2">UNSUPPORTED DETECTION</div>
                  <div className="text-xs text-gray max-w-md text-center">{errorMsg}</div>
                  <button className="btn-secondary mt-4 text-xs py-1.5 px-4" onClick={() => {
                    setSearchQuery('');
                    setActiveTarget('water');
                    setDetectionState('selected');
                  }}>Try Supported Target</button>
                </div>
              )}

              {/* READY STATE */}
              {detectionState === 'ready' && detectionResult && (
                <>
                  <div className="results-header">
                    <div className="flex items-center gap-2">
                      <div className="indicator bg-accent-blue"></div>
                      <h3 className="text-lg flex items-center gap-2">
                        <TargetIcon size={20} style={{ color: TARGET_REGISTRY[activeTarget]?.color }} />
                        {detectionResult.summary.count} {TARGET_REGISTRY[activeTarget]?.label} areas detected
                      </h3>
                      <span className="text-xs font-mono text-gray-dim ml-4">
                        Avg Confidence: {detectionResult.summary.avgConfidence.toFixed(1)}% · Total Area: {detectionResult.summary.totalArea.toFixed(1)} {TARGET_REGISTRY[activeTarget]?.resultType === 'LineString' ? 'km' : 'km²'}
                      </span>
                    </div>
                    <button 
                      className="text-xs font-mono flex items-center gap-2 hover:text-white transition-colors"
                      onClick={() => setMaskVisible(!maskVisible)}
                    >
                      <Eye size={14} className={maskVisible ? 'text-accent-blue' : 'text-gray'} /> Toggle Layer
                    </button>
                  </div>

                  <div className="results-grid mt-4 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                    {detectionResult.detections.features.map((feature, idx) => (
                      <div 
                        key={feature.properties.id} 
                        className={`result-card ${selectedFeatureId === feature.properties.id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedFeatureId(feature.properties.id);
                          const bbox = calculateBBox(feature.geometry);
                          mapInstance?.fitBounds(bbox, { padding: 150, maxZoom: 16 });
                        }}
                        onMouseEnter={() => setHoveredFeatureId(feature.properties.id)}
                        onMouseLeave={() => setHoveredFeatureId(null)}
                      >
                        <div className="card-header">
                          <span className="text-xs font-mono text-gray-dim uppercase">Result {String(idx+1).padStart(2, '0')}</span>
                          <span className={`status-pill ${feature.properties.status === 'Confirmed' ? 'success' : 'warning'}`}>
                            {feature.properties.status}
                          </span>
                        </div>
                        <h4 className="text-sm mt-2 font-medium">{feature.properties.label}</h4>
                        <div className="flex justify-between items-end mt-4">
                          <div className="text-xl font-bold">{feature.properties.area.toFixed(1)} <span className="text-xs font-normal text-gray">{feature.geometry.type === 'LineString' ? 'km' : 'km²'}</span></div>
                          <div className="text-xs font-mono flex items-center gap-1">
                            Conf: {feature.properties.confidence.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="results-footer mt-6 flex justify-between items-center border-t border-white/5 pt-4">
                    <button className="text-xs text-gray hover:text-white flex items-center gap-2 transition-colors" onClick={handleClear}>
                      <X size={14} /> Clear Session
                    </button>
                    <div className="flex gap-2">
                      <button className="btn-secondary text-xs py-1.5 px-4 flex items-center gap-2 text-gray">
                        <Download size={14} /> Export GeoJSON
                      </button>
                      <button className="btn-secondary text-xs py-1.5 px-4 flex items-center gap-2" onClick={handleFocusAOI}>
                        <Focus size={14} /> Focus AOI
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* SPATIAL INSPECTOR FOR SELECTED DETECTION */}
        <AnimatePresence>
          {selectedFeatureId && selectedFeature && (
            <motion.div 
              className="detection-inspector glass-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <TargetIcon size={16} style={{ color: TARGET_REGISTRY[activeTarget]?.color }} />
                  {selectedFeature.properties.label}
                </h3>
                <button onClick={() => setSelectedFeatureId(null)} className="text-gray hover:text-white"><X size={16} /></button>
              </div>
              
              <div className="space-y-3 text-xs mb-6 font-mono">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-dim">METRIC</span>
                  <span className="font-bold text-white text-sm">{selectedFeature.properties.area.toFixed(2)} {selectedFeature.geometry.type === 'LineString' ? 'km' : 'km²'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-dim">CONFIDENCE</span>
                  <span className="text-white">{selectedFeature.properties.confidence.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-gray-dim">STATUS</span>
                  <span className={selectedFeature.properties.status === 'Confirmed' ? 'text-success-mint' : 'text-warning'}>
                    {selectedFeature.properties.status}
                  </span>
                </div>
                {selectedFeature.properties.change && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-dim">NOTE</span>
                    <span className="text-accent-blue">{selectedFeature.properties.change}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1">
                  <span className="text-gray-dim">EVIDENCE ID</span>
                  <span className="underline cursor-pointer hover:text-white transition-colors" onClick={() => navigate(`/evidence/${detectionResult.evidenceId}`)}>
                    {detectionResult.evidenceId.substring(0, 10)}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-4">
                <button 
                  className="btn-primary text-xs justify-center py-2 flex items-center gap-2"
                  onClick={() => navigate('/ask', { state: { coords: markerCoords, context: 'detect-handoff', featureId: selectedFeature.id } })}
                >
                  <Search size={14} /> Ask about this
                </button>
                <button 
                  className="btn-secondary text-xs py-2 flex items-center justify-center gap-2"
                  onClick={() => navigate('/watch/new', { state: { geometry: selectedFeature.geometry, target: activeTarget } })}
                >
                  <Eye size={14} /> Create Watch
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </MapViewport>
    </div>
  );
}
