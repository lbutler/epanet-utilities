"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Layers } from "lucide-react";
import type { GeoJSONFeatureCollection } from "@/lib/types";

// This is a placeholder token - in a real app, you would use an environment variable
// and a proper token with restricted access
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface MapDisplayProps {
  geoJSON: GeoJSONFeatureCollection | null;
}

export function MapDisplay({ geoJSON }: MapDisplayProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map only once
    if (map.current) return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-122.4194, 37.7749], // San Francisco
        zoom: 12,
      });

      map.current.on("load", () => {
        setMapLoaded(true);
      });

      // Clean up on unmount
      return () => {
        map.current?.remove();
        map.current = null;
      };
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapLoaded(false);
    }
  }, []);

  // Update map when GeoJSON changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !geoJSON) return;

    // Remove existing layers if they exist
    if (map.current.getLayer("network-points")) {
      map.current.removeLayer("network-points");
    }
    if (map.current.getLayer("network-lines")) {
      map.current.removeLayer("network-lines");
    }
    if (map.current.getSource("network")) {
      map.current.removeSource("network");
    }

    // Add new source and layers
    map.current.addSource("network", {
      type: "geojson",
      data: geoJSON,
    });

    // Add lines
    map.current.addLayer({
      id: "network-lines",
      type: "line",
      source: "network",
      filter: ["==", ["get", "type"], "Link"],
      paint: {
        "line-color": "#3b82f6",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 4],
      },
    });

    // Add points
    map.current.addLayer({
      id: "network-points",
      type: "circle",
      source: "network",
      filter: ["==", ["get", "type"], "Node"],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 5],
        "circle-color": "#3b82f6",
        "circle-stroke-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13,
          0.5,
          16,
          1,
        ],
        "circle-stroke-color": "#ffffff",
      },
      minzoom: 13,
    });

    // Fit bounds to the network
    const coordinates = geoJSON.features.flatMap((feature) => {
      if (feature.geometry.type === "Point") {
        return [feature.geometry.coordinates as [number, number]];
      } else if (feature.geometry.type === "LineString") {
        return feature.geometry.coordinates as [number, number][];
      }
      return [];
    });

    if (coordinates.length > 0) {
      const bounds = coordinates.reduce(
        (bounds, coord) => bounds.extend(coord as mapboxgl.LngLatLike),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
      );

      map.current.fitBounds(bounds, {
        padding: 50,
      });
    }
  }, [geoJSON, mapLoaded]);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Network Visualization
        </h2>

        <div className="flex space-x-2">
          <button className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none">
            <Layers className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[400px] lg:min-h-[600px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
        {MAPBOX_TOKEN === "pk.placeholder.token" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-700">
            <div className="text-center p-6">
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                Map placeholder - Mapbox token required
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add your Mapbox token to see the actual map
              </p>
            </div>
          </div>
        ) : (
          <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
        )}
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        {geoJSON
          ? "Network data displayed on map"
          : "Upload a file to view network data"}
      </div>
    </div>
  );
}
