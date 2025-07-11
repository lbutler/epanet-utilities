"use client";

import { useState } from "react";
import { CheckCircle, X, AlertTriangle, ChevronDown } from "lucide-react";
import type { UploadedFile, EpanetElementType } from "@/lib/types";
import { ELEMENT_COLORS, isValidGeometryForElement } from "@/lib/model-builder-constants";

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
  validGeometryTypes
}: ElementAssignmentCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragError(null);

    try {
      const fileData = e.dataTransfer.getData('application/json');
      const file: UploadedFile = JSON.parse(fileData);
      
      // Validate geometry type
      const isValid = isValidGeometryForElement(file.geometryType, elementType);
      if (!isValid) {
        setDragError(`Invalid geometry type: ${file.geometryType}. Expected: ${validGeometryTypes.join(', ')}`);
        setTimeout(() => setDragError(null), 3000);
        return;
      }

      onAssign(file, elementType);
    } catch (error) {
      setDragError('Invalid file data');
      setTimeout(() => setDragError(null), 3000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fileId = e.target.value;
    if (!fileId) return;

    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    // Validate geometry type
    const isValid = isValidGeometryForElement(file.geometryType, elementType);
    if (!isValid) {
      setDragError(`Invalid geometry type: ${file.geometryType}. Expected: ${validGeometryTypes.join(', ')}`);
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    onAssign(file, elementType);
  };

  const elementColor = ELEMENT_COLORS[elementType] || '#3b82f6';

  // Filter files that are compatible with this element
  const compatibleFiles = uploadedFiles.filter(file => 
    isValidGeometryForElement(file.geometryType, elementType)
  );

  return (
    <div
      className={`
        relative p-6 border-2 border-dashed rounded-lg transition-all duration-200 min-h-[160px] flex flex-col
        ${isDragOver 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : assignedFile 
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        }
        ${dragError ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
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
        {assignedFile ? (
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {assignedFile.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {assignedFile.geometryType} • {assignedFile.featureCount} features
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
                  >
                    <option value="">Choose a file...</option>
                    {compatibleFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name} ({file.geometryType}, {file.featureCount} features)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
                {compatibleFiles.length === 0 && uploadedFiles.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    No compatible files found. Upload files with {validGeometryTypes.join(' or ')} geometry.
                  </p>
                )}
              </div>
            )}
            
            {/* Drag and Drop Area */}
            <div className="text-center border-t border-slate-200 dark:border-slate-700 pt-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                Or drag and drop GeoJSON file here
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Accepts: {validGeometryTypes.join(', ')}
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