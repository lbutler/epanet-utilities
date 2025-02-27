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
export function findMinXY(geometry: Geometry): [number, number] {
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
        line.forEach(updateMin)
      );
      break;
    case "MultiPolygon":
      (geometry.coordinates as [number, number][][][]).forEach((polygon) =>
        polygon.forEach((ring) => ring.forEach(updateMin))
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
 * Converts a coordinate from local x, y (in meters or feet) to approximate lat/lon.
 */
export function convertCoord(
  coord: [number, number],
  minX: number,
  minY: number,
  units: "meters" | "feet",
  origin: [number, number]
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
export function transformGeometry(
  geometry: Geometry,
  minX: number,
  minY: number,
  units: "meters" | "feet",
  origin: [number, number]
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
          origin
        ),
      } as Point;
    case "MultiPoint":
      return {
        type: "MultiPoint",
        coordinates: (geometry.coordinates as [number, number][]).map((coord) =>
          convertCoord(coord, minX, minY, units, origin)
        ),
      } as MultiPoint;
    case "LineString":
      return {
        type: "LineString",
        coordinates: (geometry.coordinates as [number, number][]).map((coord) =>
          convertCoord(coord, minX, minY, units, origin)
        ),
      } as LineString;
    case "MultiLineString":
      return {
        type: "MultiLineString",
        coordinates: (geometry.coordinates as [number, number][][]).map(
          (line) =>
            line.map((coord) => convertCoord(coord, minX, minY, units, origin))
        ),
      } as MultiLineString;
    case "Polygon":
      return {
        type: "Polygon",
        coordinates: (geometry.coordinates as [number, number][][]).map(
          (ring) =>
            ring.map((coord) => convertCoord(coord, minX, minY, units, origin))
        ),
      } as Polygon;
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: (geometry.coordinates as [number, number][][][]).map(
          (polygon) =>
            polygon.map((ring) =>
              ring.map((coord) =>
                convertCoord(coord, minX, minY, units, origin)
              )
            )
        ),
      } as MultiPolygon;
    case "GeometryCollection":
      return {
        type: "GeometryCollection",
        geometries: geometry.geometries.map((g) =>
          transformGeometry(g, minX, minY, units, origin)
        ),
      };
    default:
      return geometry;
  }
}

/**
 * Converts a GeoJSON FeatureCollection or Feature to approximate lat/lon.
 */
export function approximateReprojectToLatLng<
  T extends FeatureCollection | Feature
>(geojson: T, options: ApproxReprojectOptions = {}): T {
  const { units = "meters", origin = [0, 0] } = options;

  let minX: number;
  let minY: number;

  if (geojson.type === "FeatureCollection") {
    const minValues = geojson.features
      .filter((feature) => feature.geometry)
      .map((feature) => findMinXY(feature.geometry as Geometry));

    minX = Math.min(...minValues.map(([x]) => x));
    minY = Math.min(...minValues.map(([, y]) => y));
  } else if (geojson.type === "Feature" && geojson.geometry) {
    [minX, minY] = findMinXY(geojson.geometry);
  } else {
    return geojson; // If no valid geometry, return as-is
  }

  function transformFeature(feature: Feature): Feature {
    return {
      ...feature,
      geometry: feature.geometry
        ? transformGeometry(feature.geometry, minX, minY, units, origin)
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
