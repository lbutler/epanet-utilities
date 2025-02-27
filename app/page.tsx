"use client";

import { useState } from "react";
import { FileUploader } from "@/components/file-uploader";
import { ProjectionConverter } from "@/components/projection-converter";
import { MapDisplay } from "@/components/map-display";
import type {
  Coordinate,
  NetworkData,
  GeoJSONFeatureCollection,
} from "@/lib/types";
import {
  parseINPFile,
  convertCoordinates,
  convertToWGS84,
  createGeoJSON,
  generateNewINP,
} from "@/lib/network-utils";

import { toGeoJson } from "@/lib/epanet-geojson";

export default function Home() {
  const [networkData, setNetworkData] = useState<NetworkData | null>(null);
  const [sourceProjection, setSourceProjection] = useState<string>("");
  const [targetProjection, setTargetProjection] = useState<string>("");
  const [convertedCoordinates, setConvertedCoordinates] = useState<
    Coordinate[] | null
  >(null);
  const [mapData, setMapData] = useState<GeoJSONFeatureCollection | null>(null);

  const handleFileLoaded = async (file: File | null) => {
    try {
      const data = await parseINPFile(file);
      console.log(data);
      if (data?.originalContent) {
        console.log(toGeoJson(data?.originalContent));
      }
      setNetworkData(data);

      // Clear map data if no file is selected
      if (!data) {
        setMapData(null);
        setConvertedCoordinates(null);
        return;
      }

      // If source projection is already selected, update map
      if (sourceProjection) {
        const wgs84Coords = convertToWGS84(data.coordinates, sourceProjection);
        setMapData(createGeoJSON(wgs84Coords));
      }
    } catch (error) {
      console.error("Error processing file:", error);
      // Handle error appropriately (e.g., show error message to user)
      setNetworkData(null);
      setMapData(null);
      setConvertedCoordinates(null);
    }
  };

  const handleSourceProjectionChange = (projection: string) => {
    setSourceProjection(projection);

    if (networkData) {
      const wgs84Coords = convertToWGS84(networkData.coordinates, projection);
      setMapData(createGeoJSON(wgs84Coords));
    }
  };

  const handleTargetProjectionChange = (projection: string) => {
    setTargetProjection(projection);
  };

  const handleConvert = () => {
    if (!networkData || !sourceProjection || !targetProjection) return;

    const converted = convertCoordinates(
      networkData.coordinates,
      sourceProjection,
      targetProjection
    );
    setConvertedCoordinates(converted);
  };

  const handleDownload = () => {
    if (!networkData || !convertedCoordinates) return;

    const newContent = generateNewINP(
      networkData.originalContent,
      convertedCoordinates
    );

    // Create and trigger download
    const blob = new Blob([newContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted_network.inp";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            EPANET Projection Converter
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Convert your EPANET network files between different coordinate
            systems
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
              <FileUploader onFileLoaded={handleFileLoaded} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
              <ProjectionConverter
                sourceProjection={sourceProjection}
                targetProjection={targetProjection}
                onSourceChange={handleSourceProjectionChange}
                onTargetChange={handleTargetProjectionChange}
                onConvert={handleConvert}
                onDownload={handleDownload}
                canConvert={!!networkData}
                hasConverted={!!convertedCoordinates}
              />
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 h-full">
              <MapDisplay geoJSON={mapData} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
