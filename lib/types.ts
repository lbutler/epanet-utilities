export type Coordinate = [number, number];

export type NetworkData = {
  coordinates: Record<string, [number, number]>; // Node ID -> [X, Y]
  vertices: Record<string, [number, number][]>; // Link ID -> Array of [X, Y] coordinates
  inp: string;
  name: string;
};

export type GeoJSONFeature = {
  type: "Feature";
  geometry: {
    type: "Point" | "LineString";
    coordinates: Coordinate | Coordinate[];
  };
  properties: Record<string, any>;
};

export type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

export type ProjectionInputMethod = "search" | "file" | "manual";

export interface Projection {
  id: string; // EPSG code or unique identifier
  name: string; // Human-readable name of the projection
  code: string; // PROJ.4 or WKT string
}
