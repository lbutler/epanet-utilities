import type { Coordinate, NetworkData, GeoJSONFeatureCollection } from "./types"
import proj4 from "proj4"

// Parse INP file and extract coordinates
export async function parseINPFile(file: File | null): Promise<NetworkData | null> {
  // If no file is provided, return null
  if (!file) {
    return null
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const content = reader.result as string

      // Dummy coordinate extraction - replace with actual INP parsing
      const dummyCoordinates: Coordinate[] = [
        [-122.4194, 37.7749],
        [-122.4184, 37.7746],
        [-122.4174, 37.7744],
        [-122.4164, 37.7742],
      ]

      resolve({
        coordinates: dummyCoordinates,
        originalContent: content,
      })
    }

    reader.onerror = () => {
      reject(new Error("Failed to read file"))
    }

    reader.readAsText(file)
  })
}

// Convert coordinates between projections
export function convertCoordinates(
  coordinates: Coordinate[],
  sourceProjection: string,
  targetProjection: string,
): Coordinate[] {
  return coordinates.map(([x, y]) => {
    const [long, lat] = proj4(sourceProjection, targetProjection, [x, y])
    return [long, lat]
  })
}

// Convert coordinates to WGS84
export function convertToWGS84(coordinates: Coordinate[], sourceProjection: string): Coordinate[] {
  return convertCoordinates(coordinates, sourceProjection, "epsg:4326")
}

// Create GeoJSON from coordinates
export function createGeoJSON(coordinates: Coordinate[]): GeoJSONFeatureCollection {
  const features = coordinates.map((coord) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: coord,
    },
    properties: {},
  }))

  return {
    type: "FeatureCollection",
    features,
  }
}

// Generate new INP file content
export function generateNewINP(originalContent: string, coordinates: Coordinate[]): string {
  // Replace dummy coordinates in originalContent with new coordinates
  // This is a placeholder, actual implementation depends on INP file format
  return originalContent.replace(/\[-?\d+\.?\d*, -?\d+\.?\d*\]/g, JSON.stringify(coordinates))
}

