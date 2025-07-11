"use client";

import { useState } from "react";
import { CheckCircle, X, AlertTriangle, ChevronDown } from "lucide-react";
import type { UploadedFile, EpanetElementType } from "@/lib/types";
import {
  ELEMENT_COLORS,
  isValidGeometryForElement,
  getValidGeometryType,
} from "@/lib/model-builder-constants";

interface ElementAssignmentCardProps {
  elementType: EpanetElementType;
  elementName: string;
  assignedFile: UploadedFile | null;
  uploadedFiles: UploadedFile[];
  onAssign: (file: UploadedFile, elementType: EpanetElementType) => void;
  onUnassign: (elementType: EpanetElementType) => void;
  validGeometryTypes: string[];
}

export function ElementAssignmentCard({
  elementType,
  elementName,
  assignedFile,
  uploadedFiles,
  onAssign,
  onUnassign,
  validGeometryTypes,
}: ElementAssignmentCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) {
      setIsDragOver(false);
      setDragError(null);
    }
  };

  const processAndAssignFile = async (file: File) => {
    setIsProcessing(true);
    setDragError(null);

    try {
      // Check file extension
      const isGeoJSON =
        file.name.toLowerCase().endsWith(".geojson") ||
        file.name.toLowerCase().endsWith(".json");

      if (!isGeoJSON) {
        setDragError(`${file.name}: Only GeoJSON files are supported`);
        setTimeout(() => setDragError(null), 3000);
        return;
      }

      // Read and parse the file
      const content = await file.text();
      const geoJSON = JSON.parse(content);

      // Validate GeoJSON structure
      if (
        !geoJSON ||
        geoJSON.type !== "FeatureCollection" ||
        !Array.isArray(geoJSON.features)
      ) {
        setDragError(`${file.name}: Invalid GeoJSON structure`);
        setTimeout(() => setDragError(null), 3000);
        return;
      }

      if (geoJSON.features.length === 0) {
        setDragError(`${file.name}: No features found`);
        setTimeout(() => setDragError(null), 3000);
        return;
      }

      // Create UploadedFile object
      const uploadedFile: UploadedFile = {
        id: `${file.name}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        file,
        geoJSON,
        name: file.name,
        geometryType: getValidGeometryType(geoJSON),
        featureCount: geoJSON.features.length,
      };

      // Validate geometry type for this element
      const isValid = isValidGeometryForElement(
        uploadedFile.geometryType,
        elementType,
      );
      if (!isValid) {
        setDragError(
          `Invalid geometry type: ${
            uploadedFile.geometryType
          }. Expected: ${validGeometryTypes.join(", ")}`,
        );
        setTimeout(() => setDragError(null), 3000);
        return;
      }

      // Assign the file to this element
      onAssign(uploadedFile, elementType);
    } catch (error) {
      setDragError(
        `Failed to process ${file.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      setTimeout(() => setDragError(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragError(null);

    // Prevent dropping when already processing
    if (isProcessing) {
      return;
    }

    // Check if files are being dragged from the computer
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Handle files dragged from computer
      if (files.length > 1) {
        setDragError("Please drop only one file at a time");
        setTimeout(() => setDragError(null), 3000);
        return;
      }

      processAndAssignFile(files[0]);
      return;
    }

    // Handle files dragged from multi-file-dropzone
    try {
      const fileData = e.dataTransfer.getData("application/json");
      const file: UploadedFile = JSON.parse(fileData);

      // Validate geometry type
      const isValid = isValidGeometryForElement(file.geometryType, elementType);
      if (!isValid) {
        setDragError(
          `Invalid geometry type: ${
            file.geometryType
          }. Expected: ${validGeometryTypes.join(", ")}`,
        );
        setTimeout(() => setDragError(null), 3000);
        return;
      }

      onAssign(file, elementType);
    } catch (error) {
      setDragError("Invalid file data");
      setTimeout(() => setDragError(null), 3000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isProcessing) return;

    const fileId = e.target.value;
    if (!fileId) return;

    const file = uploadedFiles.find((f) => f.id === fileId);
    if (!file) return;

    // Validate geometry type
    const isValid = isValidGeometryForElement(file.geometryType, elementType);
    if (!isValid) {
      setDragError(
        `Invalid geometry type: ${
          file.geometryType
        }. Expected: ${validGeometryTypes.join(", ")}`,
      );
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    onAssign(file, elementType);
  };

  const elementColor = ELEMENT_COLORS[elementType] || "#3b82f6";

  // Filter files that are compatible with this element
  const compatibleFiles = uploadedFiles.filter((file) =>
    isValidGeometryForElement(file.geometryType, elementType),
  );

  return (
    <div
      className={`
          relative p-6 border-2 border-dashed rounded-lg transition-all duration-200 min-h-[160px] flex flex-col
          ${
            isProcessing
              ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
              : isDragOver
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : assignedFile
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
          }
          ${dragError ? "border-red-500 bg-red-50 dark:bg-red-900/20" : ""}
        `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: elementColor }}
          />
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {elementName}
          </h3>
        </div>

        {assignedFile && (
          <button
            onClick={() => onUnassign(elementType)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            title="Remove assignment"
          >
            <X className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center space-y-4">
        {isProcessing ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 dark:border-yellow-400"></div>
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              Processing file...
            </p>
          </div>
        ) : assignedFile ? (
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {assignedFile.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {assignedFile.geometryType} • {assignedFile.featureCount}{" "}
                features
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* File Selector */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Select file to assign:
                </label>
                <div className="relative">
                  <select
                    value=""
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Choose a file...</option>
                    {compatibleFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name} ({file.geometryType}, {file.featureCount}{" "}
                        features)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {compatibleFiles.length === 0 && uploadedFiles.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No compatible files found. Upload files with{" "}
                    {validGeometryTypes.join(" or ")} geometry.
                  </p>
                )}
              </div>
            )}

            {/* Drag and Drop Area */}
            <div className="text-center border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Or drag and drop a GIS file here
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mb-1">
                from your computer or loaded files
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Accepts: {validGeometryTypes.join(", ")}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error Message */}
      {dragError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-500">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm font-medium">{dragError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
