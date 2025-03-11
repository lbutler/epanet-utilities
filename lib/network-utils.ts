import type {
  Coordinate,
  NetworkData,
  GeoJSONFeatureCollection,
} from "./types";
import proj4 from "proj4";

// Parse INP file and extract coordinates
export async function parseINPFile(
  file: File | null
): Promise<NetworkData | null> {
  if (!file) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const content = reader.result as string;
      const [coordinates, vertices] = extractGeometryData(content);

      resolve({
        coordinates,
        vertices,
        inp: content,
      });
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

// Extract coordinates and vertices from an INP file string
function extractGeometryData(
  inpContent: string
): [Record<string, [number, number]>, Record<string, [number, number][]>] {
  const coordinates: Record<string, [number, number]> = {};
  const vertices: Record<string, [number, number][]> = {};

  const lines = inpContent.split("\n");
  let section: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(";") || trimmed === "") continue;

    if (trimmed.startsWith("[")) {
      section = trimmed;
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (section === "[COORDINATES]" && parts.length >= 3) {
      const [id, x, y] = parts;
      coordinates[id] = [parseFloat(x), parseFloat(y)];
    } else if (section === "[VERTICES]" && parts.length >= 3) {
      const [linkId, x, y] = parts;
      if (!vertices[linkId]) {
        vertices[linkId] = [];
      }
      vertices[linkId].push([parseFloat(x), parseFloat(y)]);
    }
  }

  return [coordinates, vertices];
}

// Update INP file with reprojected coordinates and vertices
export function updateINPWithReprojectedData(
  inpContent: string,
  networkData: NetworkData
): string {
  const lines = inpContent.split("\n");
  let section: string | null = null;
  const updatedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      section = trimmed;
      updatedLines.push(line);
      continue;
    }

    if (section === "[COORDINATES]" && trimmed) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3 && networkData.coordinates[parts[0]]) {
        const [id] = parts;
        const [newX, newY] = networkData.coordinates[id];
        updatedLines.push(`${id} ${newX.toFixed(2)} ${newY.toFixed(2)}`);
        continue;
      }
    }

    if (section === "[VERTICES]" && trimmed) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        const [linkId] = parts;
        if (networkData.vertices[linkId]) {
          networkData.vertices[linkId].forEach(([newX, newY]) => {
            updatedLines.push(
              `${linkId} ${newX.toFixed(2)} ${newY.toFixed(2)}`
            );
          });
          continue;
        }
      }
    }

    updatedLines.push(line);
  }

  return updatedLines.join("\n");
}

export function convertCoordinates(
  networkData: NetworkData,
  sourceProjection: string,
  targetProjection: string
): NetworkData {
  const transformedCoordinates: Record<string, [number, number]> = {};
  const transformedVertices: Record<string, [number, number][]> = {};

  // Convert node coordinates
  for (const [id, [x, y]] of Object.entries(networkData.coordinates)) {
    const [long, lat] = proj4(sourceProjection, targetProjection, [x, y]);
    transformedCoordinates[id] = [long, lat];
  }

  // Convert link vertices
  for (const [linkId, points] of Object.entries(networkData.vertices)) {
    transformedVertices[linkId] = points.map(([x, y]) =>
      proj4(sourceProjection, targetProjection, [x, y])
    );
  }

  return {
    coordinates: transformedCoordinates,
    vertices: transformedVertices,
    inp: networkData.inp, // Keep original INP content
  };
}

// Convert coordinates to WGS84
export function convertToWGS84(
  networkData: NetworkData,
  sourceProjection: string
): NetworkData {
  return convertCoordinates(networkData, sourceProjection, "epsg:4326");
}
