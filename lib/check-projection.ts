import { FeatureCollection, Feature, Geometry } from "geojson";

/**
 * Checks if a GeoJSON object is likely in lat/lon format by verifying
 * that all coordinates are within valid latitude (-90 to 90) and longitude (-180 to 180) ranges.
 */
export function isLikelyLatLng(geojson: FeatureCollection | Feature): boolean {
  function isValidCoord(coord: [number, number]): boolean {
    const [lon, lat] = coord;
    return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
  }

  function checkGeometry(geometry: Geometry): boolean {
    if (!geometry) return false;

    function traverseCoords(coords: any): boolean {
      if (typeof coords[0] === "number") {
        return isValidCoord(coords as [number, number]);
      } else {
        return coords.every(traverseCoords);
      }
    }

    switch (geometry.type) {
      case "Point":
        return isValidCoord(geometry.coordinates as [number, number]);
      case "MultiPoint":
      case "LineString":
        return (geometry.coordinates as [number, number][]).every(isValidCoord);
      case "MultiLineString":
      case "Polygon":
        return (geometry.coordinates as [number, number][][]).every((line) =>
          line.every(isValidCoord)
        );
      case "MultiPolygon":
        return (geometry.coordinates as [number, number][][][]).every(
          (polygon) => polygon.every((ring) => ring.every(isValidCoord))
        );
      case "GeometryCollection":
        return geometry.geometries.every(checkGeometry);
      default:
        return false;
    }
  }

  if (geojson.type === "FeatureCollection") {
    return geojson.features.every(
      (feature) => feature.geometry && checkGeometry(feature.geometry)
    );
  } else if (geojson.type === "Feature") {
    return geojson.geometry ? checkGeometry(geojson.geometry) : false;
  }

  return false;
}
