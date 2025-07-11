import { EpanetElementDefinition } from './types';

export const EPANET_ELEMENTS: EpanetElementDefinition[] = [
  {
    key: 'pipes',
    name: 'Pipes',
    geometryTypes: ['LineString', 'MultiLineString'],
    requiredAttributes: ['Id', 'Node1', 'Node2', 'Length', 'Diameter', 'Roughness'],
    optionalAttributes: ['MinorLoss', 'Status', 'Comment'],
    defaultValues: {
      Length: 1000,
      Diameter: 150,
      Roughness: 100,
      MinorLoss: 0,
      Status: 'Open'
    }
  },
  {
    key: 'nodes',
    name: 'Nodes',
    geometryTypes: ['Point', 'MultiPoint'],
    requiredAttributes: ['Id', 'Elevation'],
    optionalAttributes: ['Demand', 'Pattern', 'Comment'],
    defaultValues: {
      Elevation: 0,
      Demand: 0
    }
  },
  {
    key: 'valves',
    name: 'Valves',
    geometryTypes: ['Point', 'MultiPoint'],
    requiredAttributes: ['Id', 'Node1', 'Node2', 'Diameter', 'Type', 'Setting'],
    optionalAttributes: ['MinorLoss', 'Comment'],
    defaultValues: {
      Diameter: 150,
      Type: 'PRV',
      Setting: 0,
      MinorLoss: 0
    }
  },
  {
    key: 'pumps',
    name: 'Pumps',
    geometryTypes: ['Point', 'MultiPoint'],
    requiredAttributes: ['Id', 'Node1', 'Node2'],
    optionalAttributes: ['Parameters', 'Comment'],
    defaultValues: {
      Parameters: 'POWER 5'
    }
  },
  {
    key: 'tanks',
    name: 'Tanks',
    geometryTypes: ['Point', 'MultiPoint'],
    requiredAttributes: ['Id', 'Elevation', 'InitLevel', 'MinLevel', 'MaxLevel', 'Diameter'],
    optionalAttributes: ['MinVolume', 'VolumeCurve', 'Comment'],
    defaultValues: {
      Elevation: 0,
      InitLevel: 5,
      MinLevel: 0,
      MaxLevel: 10,
      Diameter: 50,
      MinVolume: 0
    }
  },
  {
    key: 'reservoirs',
    name: 'Reservoirs',
    geometryTypes: ['Point', 'MultiPoint'],
    requiredAttributes: ['Id', 'Head'],
    optionalAttributes: ['Pattern', 'Comment'],
    defaultValues: {
      Head: 0
    }
  }
];

export const ELEMENT_COLORS = {
  pipes: '#3b82f6',
  valves: '#f59e0b',
  nodes: '#10b981',
  pumps: '#ef4444',
  tanks: '#8b5cf6',
  reservoirs: '#06b6d4'
};

export function getValidGeometryType(geoJSON: any): string {
  if (!geoJSON || !geoJSON.features || geoJSON.features.length === 0) {
    return 'Unknown';
  }
  
  const geometryTypes = new Set<string>();
  
  geoJSON.features.forEach((feature: any) => {
    if (feature.geometry && feature.geometry.type) {
      geometryTypes.add(feature.geometry.type);
    }
  });
  
  if (geometryTypes.size === 1) {
    return Array.from(geometryTypes)[0];
  } else if (geometryTypes.size > 1) {
    return 'Mixed';
  }
  
  return 'Unknown';
}

export function isValidGeometryForElement(geometryType: string, elementType: string): boolean {
  const element = EPANET_ELEMENTS.find(e => e.key === elementType);
  if (!element) return false;
  
  return element.geometryTypes.includes(geometryType);
}

export function getGeoJSONProperties(geoJSON: any): string[] {
  if (!geoJSON || !geoJSON.features || geoJSON.features.length === 0) {
    return [];
  }
  
  const allProperties = new Set<string>();
  
  geoJSON.features.forEach((feature: any) => {
    if (feature.properties) {
      Object.keys(feature.properties).forEach(key => {
        allProperties.add(key);
      });
    }
  });
  
  return Array.from(allProperties).sort();
}