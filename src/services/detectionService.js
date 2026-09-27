export const TARGET_REGISTRY = {
  water: {
    id: 'water',
    label: 'Water',
    supportedDatasets: ['sentinel-2', 'landsat-8', 'sar'],
    resultType: 'Polygon',
    description: 'Detects water bodies, rivers, and lakes using NDWI and SAR workflows.',
    color: '#06b6d4', // cyan
    fillOpacity: 0.3,
  },
  vegetation: {
    id: 'vegetation',
    label: 'Vegetation',
    supportedDatasets: ['sentinel-2', 'landsat-8'],
    resultType: 'Polygon',
    description: 'Measures vegetation health and coverage using NDVI.',
    color: '#10b981', // emerald
    fillOpacity: 0.2,
  },
  buildings: {
    id: 'buildings',
    label: 'Buildings',
    supportedDatasets: ['high-res-optical'],
    resultType: 'Polygon',
    description: 'Identifies individual building footprints.',
    color: '#3b82f6', // blue
    fillOpacity: 0.2,
  },
  construction: {
    id: 'construction',
    label: 'Construction',
    supportedDatasets: ['sentinel-2', 'high-res-optical'],
    resultType: 'Polygon',
    description: 'Detects active construction and temporal structural changes.',
    color: '#f59e0b', // amber
    fillOpacity: 0.25,
  },
  roads: {
    id: 'roads',
    label: 'Roads',
    supportedDatasets: ['high-res-optical', 'sentinel-2'],
    resultType: 'LineString',
    description: 'Extracts road networks and segments.',
    color: '#f97316', // orange
    lineThickness: 3,
  },
  burn: {
    id: 'burn',
    label: 'Burn Areas',
    supportedDatasets: ['sentinel-2', 'landsat-8'],
    resultType: 'Polygon',
    description: 'Detects burn scars and calculates burned area extent.',
    color: '#ef4444', // red
    fillOpacity: 0.3,
  },
};

// Simple router to match text to target
export const detectRouter = (query) => {
  if (!query) return null;
  const q = query.toLowerCase();
  
  if (q.includes('water') || q.includes('lake') || q.includes('pond') || q.includes('river')) return 'water';
  if (q.includes('veg') || q.includes('tree') || q.includes('forest') || q.includes('plant')) return 'vegetation';
  if (q.includes('build') || q.includes('house')) return 'buildings';
  if (q.includes('construct') || q.includes('chang')) return 'construction';
  if (q.includes('road') || q.includes('highway') || q.includes('street')) return 'roads';
  if (q.includes('burn') || q.includes('fire')) return 'burn';
  
  return 'unsupported';
};

// Generates valid GeoJSON mock detections within a bounding box
function generateMockDetections(targetId, bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  
  const count = Math.floor(Math.random() * 4) + 1; // 1 to 4 detections
  const features = [];
  
  const width = maxLng - minLng;
  const height = maxLat - minLat;
  
  const targetDef = TARGET_REGISTRY[targetId];
  
  for (let i = 0; i < count; i++) {
    // Pick a random center inside the bbox
    const cLng = minLng + (width * 0.2) + (Math.random() * width * 0.6);
    const cLat = minLat + (height * 0.2) + (Math.random() * height * 0.6);
    
    const objWidth = width * (0.1 + Math.random() * 0.2);
    const objHeight = height * (0.1 + Math.random() * 0.2);
    
    let geometry;
    let area = 0;
    
    if (targetDef.resultType === 'LineString') {
      geometry = {
        type: 'LineString',
        coordinates: [
          [cLng - objWidth, cLat - objHeight],
          [cLng, cLat + objHeight/2],
          [cLng + objWidth, cLat + objHeight]
        ]
      };
      area = (Math.random() * 5 + 1).toFixed(1); // represented as length in km
    } else {
      geometry = {
        type: 'Polygon',
        coordinates: [[
          [cLng - objWidth, cLat - objHeight],
          [cLng + objWidth, cLat - objHeight],
          [cLng + objWidth/2, cLat + objHeight],
          [cLng - objWidth/2, cLat + objHeight],
          [cLng - objWidth, cLat - objHeight]
        ]]
      };
      area = (Math.random() * 20 + 2).toFixed(1); // represented as area in sq km
    }
    
    const confidence = (85 + Math.random() * 14).toFixed(1);
    
    let label = `${targetDef.label} Candidate`;
    if (targetId === 'water') label = 'Water Body';
    else if (targetId === 'vegetation') label = 'Vegetation Region';
    else if (targetId === 'buildings') label = 'Building Footprint';
    else if (targetId === 'construction') label = 'Active Construction';
    else if (targetId === 'roads') label = 'Road Segment';
    else if (targetId === 'burn') label = 'Burned Area';

    features.push({
      type: 'Feature',
      id: `det-${Date.now()}-${i}`,
      properties: {
        id: `det-${Date.now()}-${i}`,
        targetType: targetId,
        label: `${label} ${String(i+1).padStart(2, '0')}`,
        confidence: Number(confidence),
        area: Number(area),
        status: confidence > 90 ? 'Confirmed' : 'Candidate',
        change: targetId === 'construction' ? '+ New Structure' : undefined
      },
      geometry
    });
  }
  
  return features;
}

// Main detection service
export const detect = async (request) => {
  const { query, targetType, geometry, dataset, date } = request;
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  let finalTargetType = targetType;
  if (query) {
    const routedType = detectRouter(query);
    if (routedType === 'unsupported') {
      return {
        status: 'error',
        error: 'UNSUPPORTED_TARGET',
        message: 'SATQUERY cannot reliably detect that target type yet. I can currently detect Water, Vegetation, Buildings, Construction, Roads, and Burn Areas.',
      };
    }
    finalTargetType = routedType;
  }
  
  if (!TARGET_REGISTRY[finalTargetType]) {
    return {
      status: 'error',
      error: 'INVALID_TARGET',
      message: 'Invalid target type selected.'
    };
  }
  
  // Compute bounding box from geometry coordinates to generate mock data
  let bbox = [-180, -90, 180, 90];
  if (geometry && geometry.coordinates && geometry.coordinates.length > 0) {
    let coords = [];
    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates[0];
    } else {
      coords = geometry.coordinates;
    }
    
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    coords.forEach(coord => {
      if (coord[0] < minLng) minLng = coord[0];
      if (coord[1] < minLat) minLat = coord[1];
      if (coord[0] > maxLng) maxLng = coord[0];
      if (coord[1] > maxLat) maxLat = coord[1];
    });
    bbox = [minLng, minLat, maxLng, maxLat];
  }
  
  // Occasionally simulate insufficient data (e.g. 5% chance)
  if (Math.random() < 0.05) {
    return {
      status: 'error',
      error: 'INSUFFICIENT_DATA',
      message: 'Cloud cover exceeds 90% or sensor data is unavailable for this date range.'
    };
  }
  
  const features = generateMockDetections(finalTargetType, bbox);
  
  return {
    id: `req-${Date.now()}`,
    status: 'success',
    targetType: finalTargetType,
    dataset: dataset || 'Sentinel-2',
    date: date || new Date().toISOString().split('T')[0],
    aoi: geometry,
    detections: {
      type: 'FeatureCollection',
      features: features
    },
    summary: {
      count: features.length,
      totalArea: features.reduce((acc, f) => acc + f.properties.area, 0),
      avgConfidence: features.reduce((acc, f) => acc + f.properties.confidence, 0) / features.length
    },
    evidenceId: `ev-${Date.now()}`
  };
};
