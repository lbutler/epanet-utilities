import {
  FeatureCollection,
  Feature,
  Geometry,
  Point,
  LineString,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
} from "geojson";

interface ApproxReprojectOptions {
  units?: "meters" | "feet";
  origin?: [number, number]; // Default: [0, 0] (longitude, latitude)
}

/**
 * Finds the minimum x and y values in a GeoJSON geometry.
 */
function findMinXY(geometry: Geometry): [number, number] {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;

  function updateMin(coord: [number, number]) {
    const [x, y] = coord;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }

  switch (geometry.type) {
    case "Point":
      updateMin(geometry.coordinates as [number, number]);
      break;
    case "MultiPoint":
    case "LineString":
      (geometry.coordinates as [number, number][]).forEach(updateMin);
      break;
    case "MultiLineString":
    case "Polygon":
      (geometry.coordinates as [number, number][][]).forEach((line) =>
        line.forEach(updateMin),
      );
      break;
    case "MultiPolygon":
      (geometry.coordinates as [number, number][][][]).forEach((polygon) =>
        polygon.forEach((ring) => ring.forEach(updateMin)),
      );
      break;
    case "GeometryCollection":
      geometry.geometries.forEach((g) => {
        const [subMinX, subMinY] = findMinXY(g);
        if (subMinX < minX) minX = subMinX;
        if (subMinY < minY) minY = subMinY;
      });
      break;
  }

  return [minX, minY];
}

/**
 * Finds the global minimum x and y values across multiple GeoJSON objects.
 */
function findGlobalMinXY(
  geojsonArray: (FeatureCollection | Feature | null)[],
): [number, number] {
  let globalMinX = Number.POSITIVE_INFINITY;
  let globalMinY = Number.POSITIVE_INFINITY;

  geojsonArray.forEach((geojson) => {
    if (!geojson) return;

    if (geojson.type === "FeatureCollection") {
      geojson.features.forEach((feature) => {
        if (feature.geometry) {
          const [minX, minY] = findMinXY(feature.geometry);
          if (minX < globalMinX) globalMinX = minX;
          if (minY < globalMinY) globalMinY = minY;
        }
      });
    } else if (geojson.type === "Feature" && geojson.geometry) {
      const [minX, minY] = findMinXY(geojson.geometry);
      if (minX < globalMinX) globalMinX = minX;
      if (minY < globalMinY) globalMinY = minY;
    }
  });

  return [globalMinX, globalMinY];
}

/**
 * Converts a coordinate from local x, y (in meters or feet) to approximate lat/lon.
 */
function convertCoord(
  coord: [number, number],
  minX: number,
  minY: number,
  units: "meters" | "feet",
  origin: [number, number],
): [number, number] {
  const METERS_PER_DEGREE = 111320; // Approximate conversion at the equator
  const toMetersFactor = units === "feet" ? 0.3048 : 1.0;

  const [originLon, originLat] = origin;
  const xShifted = coord[0] - minX;
  const yShifted = coord[1] - minY;

  const lonOffset = (xShifted * toMetersFactor) / METERS_PER_DEGREE;
  const latOffset = (yShifted * toMetersFactor) / METERS_PER_DEGREE;

  return [originLon + lonOffset, originLat + latOffset];
}

/**
 * Transforms a geometry by applying approximate reprojection.
 */
function transformGeometry(
  geometry: Geometry,
  minX: number,
  minY: number,
  units: "meters" | "feet",
  origin: [number, number],
): Geometry {
  switch (geometry.type) {
    case "Point":
      return {
        type: "Point",
        coordinates: convertCoord(
          geometry.coordinates as [number, number],
          minX,
          minY,
          units,
          origin,
        ),
      } as Point;
    case "MultiPoint":
      return {
        type: "MultiPoint",
        coordinates: (geometry.coordinates as [number, number][]).map((coord) =>
          convertCoord(coord, minX, minY, units, origin),
        ),
      } as MultiPoint;
    case "LineString":
      return {
        type: "LineString",
        coordinates: (geometry.coordinates as [number, number][]).map((coord) =>
          convertCoord(coord, minX, minY, units, origin),
        ),
      } as LineString;
    case "MultiLineString":
      return {
        type: "MultiLineString",
        coordinates: (geometry.coordinates as [number, number][][]).map(
          (line) =>
            line.map((coord) => convertCoord(coord, minX, minY, units, origin)),
        ),
      } as MultiLineString;
    case "Polygon":
      return {
        type: "Polygon",
        coordinates: (geometry.coordinates as [number, number][][]).map(
          (ring) =>
            ring.map((coord) => convertCoord(coord, minX, minY, units, origin)),
        ),
      } as Polygon;
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: (geometry.coordinates as [number, number][][][]).map(
          (polygon) =>
            polygon.map((ring) =>
              ring.map((coord) =>
                convertCoord(coord, minX, minY, units, origin),
              ),
            ),
        ),
      } as MultiPolygon;
    case "GeometryCollection":
      return {
        type: "GeometryCollection",
        geometries: geometry.geometries.map((g) =>
          transformGeometry(g, minX, minY, units, origin),
        ),
      };
    default:
      return geometry;
  }
}

/**
 * Transforms a single GeoJSON object using provided global min values.
 */
function transformGeoJSON<T extends FeatureCollection | Feature>(
  geojson: T,
  globalMinX: number,
  globalMinY: number,
  units: "meters" | "feet",
  origin: [number, number],
): T {
  function transformFeature(feature: Feature): Feature {
    return {
      ...feature,
      geometry: feature.geometry
        ? transformGeometry(
            feature.geometry,
            globalMinX,
            globalMinY,
            units,
            origin,
          )
        : feature.geometry,
    };
  }

  if (geojson.type === "FeatureCollection") {
    return {
      ...geojson,
      features: geojson.features.map(transformFeature),
    } as T;
  }

  return transformFeature(geojson) as T;
}

/**
 * Converts multiple GeoJSON objects to approximate lat/lon using global min/max values.
 * This ensures all datasets are aligned consistently.
 */
export function approximateReprojectToLatLng<
  T extends FeatureCollection | Feature,
>(
  geojsonArray: (T | null)[],
  options: ApproxReprojectOptions = {},
): (T | null)[] {
  const { units = "meters", origin = [0, 0] } = options;

  // Filter out null values for processing
  const validGeojsonArray = geojsonArray.filter(
    (geojson): geojson is T => geojson !== null,
  );

  if (validGeojsonArray.length === 0) {
    return geojsonArray; // Return original array if no valid data
  }

  // Find global min values across all datasets
  const [globalMinX, globalMinY] = findGlobalMinXY(validGeojsonArray);

  // Transform each GeoJSON using the global min values
  return geojsonArray.map((geojson) => {
    if (!geojson) return null;
    return transformGeoJSON(geojson, globalMinX, globalMinY, units, origin);
  });
}

/**
 * Convenience function for single GeoJSON objects (backward compatibility).
 * Wraps the input in an array, processes it, and returns the single result.
 */
export function approximateReprojectToLatLngSingle<
  T extends FeatureCollection | Feature,
>(geojson: T, options: ApproxReprojectOptions = {}): T {
  const result = approximateReprojectToLatLng([geojson], options);
  return result[0] as T;
}
