"use client";

import { ChevronRight } from "lucide-react";
import type { UploadedFile, AssignedGisData, EpanetElementType } from "@/lib/types";
import { EPANET_ELEMENTS } from "@/lib/model-builder-constants";
import { MultiFileDropzone } from "./multi-file-dropzone";
import { ElementAssignmentCard } from "./element-assignment-card";
import { ModelBuilderMap } from "./model-builder-map";

interface DataAssignmentStepProps {
  uploadedFiles: UploadedFile[];
  assignedGisData: AssignedGisData;
  onFilesUploaded: (files: UploadedFile[]) => void;
  onFileAssignment: (file: UploadedFile, elementType: EpanetElementType) => void;
  onFileUnassignment: (elementType: EpanetElementType) => void;
  onNext: () => void;
}

export function DataAssignmentStep({
  uploadedFiles,
  assignedGisData,
  onFilesUploaded,
  onFileAssignment,
  onFileUnassignment,
  onNext
}: DataAssignmentStepProps) {
  const hasAssignedFiles = Object.keys(assignedGisData).length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column - File Upload and Assignment */}
      <div className="lg:col-span-5 space-y-6">
        {/* File Upload Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
          <MultiFileDropzone
            onFilesLoaded={onFilesUploaded}
            uploadedFiles={uploadedFiles}
          />
        </div>

        {/* Element Assignment Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
            Assign Files to Elements
          </h2>
          
          <div className="space-y-4">
            {EPANET_ELEMENTS.map((element) => {
              const assignedFile = assignedGisData[element.key] 
                ? {
                    // Create a simplified UploadedFile representation
                    id: `assigned_${element.key}`,
                    name: `${element.name} Data`,
                    geometryType: assignedGisData[element.key]?.features[0]?.geometry?.type || 'Unknown',
                    featureCount: assignedGisData[element.key]?.features?.length || 0,
                    file: null as any,
                    geoJSON: assignedGisData[element.key]!
                  }
                : null;

              return (
                <ElementAssignmentCard
                  key={element.key}
                  elementType={element.key}
                  elementName={element.name}
                  assignedFile={assignedFile}
                  onAssign={onFileAssignment}
                  onUnassign={onFileUnassignment}
                  validGeometryTypes={element.geometryTypes}
                />
              );
            })}
          </div>
        </div>

        {/* Next Button */}
        <div className="flex justify-end">
          <button
            onClick={onNext}
            disabled={!hasAssignedFiles}
            className={`
              flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors
              ${hasAssignedFiles 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            <span>Next: Map Attributes</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Right Column - Map Display */}
      <div className="lg:col-span-7">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 h-full">
          <ModelBuilderMap assignedGisData={assignedGisData} />
        </div>
      </div>
    </div>
  );
}