import React, { useRef, useEffect, useState } from 'react';
import maplibregl from '../lib/maplibre';
import { motion, AnimatePresence } from 'framer-motion';

export default function MapViewport({ 
  center = [72.5714, 23.0225], 
  zoom = 12, 
  onMapLoad,
  onMapClick,
  onMapMove,
  hoverCoords,
  setHoverCoords,
  markerCoords,
  tileUrl,
  children 
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRef = useRef(null);

  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (map.current) return;
    
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            satellite: {
              type: 'raster',
              tiles: [tileUrl || 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
              tileSize: 256,
              attribution: 'Sentinel-2'
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
        center: center,
        zoom: zoom,
        attributionControl: false
      });

      map.current.on('load', () => {
        if (onMapLoad) onMapLoad(map.current);
      });

      map.current.on('move', () => {
        if (onMapMove) {
          const c = map.current.getCenter();
          onMapMove(c, map.current.getZoom());
        }
      });

      map.current.on('mousemove', (e) => {
        requestAnimationFrame(() => {
          if (setHoverCoords) {
            setHoverCoords({
              lng: e.lngLat.lng.toFixed(4),
              lat: e.lngLat.lat.toFixed(4),
              x: e.point.x,
              y: e.point.y
            });
          }
        });
      });

      map.current.on('mouseout', () => {
        if (setHoverCoords) setHoverCoords(null);
      });

      map.current.on('click', (e) => {
        if (onMapClick) onMapClick(e.lngLat);
      });
    } catch (err) {
      console.error('Map initialization failed:', err);
      setMapError(true);
    }
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (markerCoords) {
      if (!markerRef.current) {
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

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const newTiles = tileUrl ? [tileUrl] : ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'];
    
    if (map.current.getLayer('satellite-layer')) map.current.removeLayer('satellite-layer');
    if (map.current.getSource('satellite')) map.current.removeSource('satellite');
    
    map.current.addSource('satellite', {
      type: 'raster',
      tiles: newTiles,
      tileSize: 256
    });
    
    map.current.addLayer({
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 22
    });
  }, [tileUrl]);

  return (
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
      
      {children}
    </div>
  );
}
