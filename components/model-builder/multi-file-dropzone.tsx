"use client";

import React, { useState } from "react";
import { Upload, FileText, AlertCircle, X } from "lucide-react";
import type { UploadedFile } from "@/lib/types";
import { getValidGeometryType } from "@/lib/model-builder-constants";

interface MultiFileDropzoneProps {
  onFilesLoaded: (files: UploadedFile[]) => void;
  uploadedFiles: UploadedFile[];
}

export function MultiFileDropzone({ onFilesLoaded, uploadedFiles }: MultiFileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      processFiles(files);
    }
  };

  const processFiles = async (files: File[]) => {
    setError(null);
    setIsProcessing(true);

    const validFiles: UploadedFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        // Check file extension
        const isGeoJSON = file.name.toLowerCase().endsWith('.geojson') || 
                         file.name.toLowerCase().endsWith('.json');
        
        if (!isGeoJSON) {
          errors.push(`${file.name}: Only GeoJSON files are supported`);
          continue;
        }

        // Read and parse the file
        const content = await file.text();
        const geoJSON = JSON.parse(content);

        // Validate GeoJSON structure
        if (!geoJSON || geoJSON.type !== 'FeatureCollection' || !Array.isArray(geoJSON.features)) {
          errors.push(`${file.name}: Invalid GeoJSON structure`);
          continue;
        }

        if (geoJSON.features.length === 0) {
          errors.push(`${file.name}: No features found`);
          continue;
        }

        // Create UploadedFile object
        const uploadedFile: UploadedFile = {
          id: `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          file,
          geoJSON,
          name: file.name,
          geometryType: getValidGeometryType(geoJSON),
          featureCount: geoJSON.features.length
        };

        validFiles.push(uploadedFile);
      } catch (err) {
        errors.push(`${file.name}: Failed to parse file - ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    setIsProcessing(false);

    if (errors.length > 0) {
      setError(errors.join('; '));
    }

    if (validFiles.length > 0) {
      onFilesLoaded([...uploadedFiles, ...validFiles]);
    }
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = uploadedFiles.filter(f => f.id !== fileId);
    onFilesLoaded(updatedFiles);
  };

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex-shrink-0">
        Upload GeoJSON Files
      </h2>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors flex-shrink-0 ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full">
            <Upload className="h-6 w-6 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Drag and drop GeoJSON files here
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              or click to browse files (supports multiple files)
            </p>
          </div>
          <input
            type="file"
            accept=".geojson,.json"
            multiple
            className="hidden"
            id="multi-file-upload"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          <label
            htmlFor="multi-file-upload"
            className={`px-4 py-2 text-sm font-medium text-white rounded-md cursor-pointer transition-colors ${
              isProcessing
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            }`}
          >
            {isProcessing ? 'Processing...' : 'Select Files'}
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-center text-red-600 dark:text-red-400 text-sm mt-3 flex-shrink-0">
          <AlertCircle className="h-4 w-4 mr-1" />
          <span>{error}</span>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mt-4 flex-1 flex flex-col min-h-0">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex-shrink-0">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-md"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify(file));
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {file.geometryType} • {file.featureCount} features
                  </p>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="ml-4 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex-shrink-0"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}