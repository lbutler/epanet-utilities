export type Coordinate = [number, number]

export type NetworkData = {
  coordinates: Coordinate[]
  originalContent: string
}

export type GeoJSONFeature = {
  type: "Feature"
  geometry: {
    type: "Point" | "LineString"
    coordinates: Coordinate | Coordinate[]
  }
  properties: Record<string, any>
}

export type GeoJSONFeatureCollection = {
  type: "FeatureCollection"
  features: GeoJSONFeature[]
}

export type Projection = {
  id: string
  name: string
  code: string
  proj4?: string
}

export type ProjectionInputMethod = "search" | "file" | "manual"

