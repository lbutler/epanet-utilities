"use client";

import React, { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type {
  ModelBuilderStep,
  UploadedFile,
  AssignedGisData,
  AttributeMapping,
  EpanetElementType,
  Projection,
} from "@/lib/types";
import { EPANET_ELEMENTS } from "@/lib/model-builder-constants";
import { isLikelyLatLng } from "@/lib/check-projection";

// Import components (we'll create these)
import { DataAssignmentStep } from "@/components/model-builder/data-assignment-step";
import { AttributeMappingStep } from "@/components/model-builder/attribute-mapping-step";

const ModelBuilderPage = () => {
  // State management
  const [currentStep, setCurrentStep] =
    useState<ModelBuilderStep>("dataAssignment");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [assignedGisData, setAssignedGisData] = useState<AssignedGisData>({});
  const [attributeMapping, setAttributeMapping] = useState<AttributeMapping>(
    {},
  );

  // Projection state
  const [projections, setProjections] = useState<Projection[]>([]);
  const [loadingProjections, setLoadingProjections] = useState<boolean>(true);
  const [selectedProjection, setSelectedProjection] =
    useState<Projection | null>(null);
  const [originalProjection, setOriginalProjection] =
    useState<Projection | null>(null);

  // Load projections
  useEffect(() => {
    let ignore = false;
    fetch("/projections.json")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setProjections(data);
        }
      })
      .catch((err) => console.error("Failed to load projection data:", err))
      .finally(() => setLoadingProjections(false));
    return () => {
      ignore = true;
    };
  }, []);

  // Check if data needs reprojection
  const checkDataNeedsReprojection = () => {
    const allGeoJSON = Object.values(assignedGisData).concat(
      uploadedFiles.map((f) => f.geoJSON),
    );

    return allGeoJSON.some((geoJSON) => geoJSON && !isLikelyLatLng(geoJSON));
  };

  const isDataLatLng = () => {
    const allGeoJSON = Object.values(assignedGisData).concat(
      uploadedFiles.map((f) => f.geoJSON),
    );

    return allGeoJSON.every((geoJSON) => geoJSON && isLikelyLatLng(geoJSON));
  };

  // Handlers
  const handleFilesUploaded = (files: UploadedFile[]) => {
    setUploadedFiles(files);
  };

  const handleProjectionSelect = (projection: Projection | null) => {
    setSelectedProjection(projection);
    if (projection && !originalProjection) {
      setOriginalProjection(projection);
    }
  };

  const handleFileAssignment = (
    file: UploadedFile,
    elementType: EpanetElementType,
  ) => {
    // Add the file to assigned data
    setAssignedGisData((prev) => ({
      ...prev,
      [elementType]: file.geoJSON,
    }));

    // Remove the file from uploaded files
    setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));

    // Initialize attribute mapping for this element type
    const element = EPANET_ELEMENTS.find((e) => e.key === elementType);
    if (element) {
      const allAttributes = [
        ...element.requiredAttributes,
        ...element.optionalAttributes,
      ];
      const initialMapping = allAttributes.reduce((acc, attr) => {
        acc[attr] = null;
        return acc;
      }, {} as Record<string, string | null>);

      setAttributeMapping((prev) => ({
        ...prev,
        [elementType]: initialMapping,
      }));
    }

    toast({
      title: "✅ File Assigned",
      description: `${file.name} has been assigned to ${element?.name}`,
    });
  };

  const handleFileUnassignment = (elementType: EpanetElementType) => {
    const assignedFile = assignedGisData[elementType];
    if (assignedFile) {
      // Find the original file info or create a new one
      const fileName = `${elementType}_data.geojson`;
      const newFile: UploadedFile = {
        id: `unassigned_${elementType}_${Date.now()}`,
        file: new File([JSON.stringify(assignedFile)], fileName, {
          type: "application/json",
        }),
        geoJSON: assignedFile,
        name: fileName,
        geometryType: assignedFile.features[0]?.geometry?.type || "Unknown",
        featureCount: assignedFile.features.length,
      };

      setUploadedFiles((prev) => [...prev, newFile]);

      // Remove from assigned data
      setAssignedGisData((prev) => {
        const newAssigned = { ...prev };
        delete newAssigned[elementType];
        return newAssigned;
      });

      // Remove from attribute mapping
      setAttributeMapping((prev) => {
        const newMapping = { ...prev };
        delete newMapping[elementType];
        return newMapping;
      });

      toast({
        title: "↩️ File Unassigned",
        description: `File has been returned to unassigned files`,
      });
    }
  };

  const handleAttributeMappingChange = (
    elementType: string,
    attribute: string,
    propertyName: string | null,
  ) => {
    setAttributeMapping((prev) => ({
      ...prev,
      [elementType]: {
        ...prev[elementType],
        [attribute]: propertyName,
      },
    }));
  };

  const handleNextStep = () => {
    if (currentStep === "dataAssignment") {
      // Check if at least one file is assigned
      const hasAssignedFiles = Object.keys(assignedGisData).length > 0;
      if (!hasAssignedFiles) {
        toast({
          title: "⚠️ No Files Assigned",
          description:
            "Please assign at least one file to an element before proceeding.",
          variant: "destructive",
        });
        return;
      }

      // Check if data needs reprojection and projection is selected
      const needsReprojection = checkDataNeedsReprojection();
      const dataIsLatLng = isDataLatLng();

      if (needsReprojection && !dataIsLatLng && !selectedProjection) {
        toast({
          title: "⚠️ Projection Required",
          description:
            "Your data appears to be in a projected coordinate system. Please select a projection to continue.",
          variant: "destructive",
        });
        return;
      }

      setCurrentStep("attributeMapping");
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === "attributeMapping") {
      setCurrentStep("dataAssignment");
    }
  };

  const handleBuildModel = () => {
    // Create the final configuration object
    const config = {
      assignedData: assignedGisData,
      attributeMapping,
      projection: {
        originalProjection: originalProjection,
        selectedProjection: selectedProjection,
        needsReprojection: checkDataNeedsReprojection(),
        dataIsLatLng: isDataLatLng(),
      },
      metadata: {
        createdAt: new Date().toISOString(),
        version: "1.0.0",
      },
    };

    // Download the configuration as JSON
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `epanet-model-config-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "🎉 Model Configuration Generated",
      description: "Your EPANET model configuration has been downloaded.",
    });
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <Toaster />

      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
          EPANET Model Builder
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          Build an EPANET model from GIS data through a simple two-step process
        </p>
      </header>

      {/* Step Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center space-x-8">
          <div
            className={`flex items-center space-x-2 ${
              currentStep === "dataAssignment"
                ? "text-blue-600"
                : "text-slate-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === "dataAssignment"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              1
            </div>
            <span className="font-medium">Data Assignment</span>
          </div>

          <div
            className={`w-16 h-0.5 ${
              currentStep === "attributeMapping"
                ? "bg-blue-600"
                : "bg-slate-200"
            }`}
          ></div>

          <div
            className={`flex items-center space-x-2 ${
              currentStep === "attributeMapping"
                ? "text-blue-600"
                : "text-slate-400"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === "attributeMapping"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              2
            </div>
            <span className="font-medium">Attribute Mapping</span>
          </div>
        </div>
      </div>

      {/* Render current step */}
      {currentStep === "dataAssignment" ? (
        <DataAssignmentStep
          uploadedFiles={uploadedFiles}
          assignedGisData={assignedGisData}
          onFilesUploaded={handleFilesUploaded}
          onFileAssignment={handleFileAssignment}
          onFileUnassignment={handleFileUnassignment}
          onNext={handleNextStep}
          projections={projections}
          loadingProjections={loadingProjections}
          selectedProjection={selectedProjection}
          onProjectionSelect={handleProjectionSelect}
          needsReprojection={checkDataNeedsReprojection()}
        />
      ) : (
        <AttributeMappingStep
          assignedGisData={assignedGisData}
          attributeMapping={attributeMapping}
          onAttributeMappingChange={handleAttributeMappingChange}
          onPrevious={handlePreviousStep}
          onBuildModel={handleBuildModel}
        />
      )}
    </main>
  );
};

export default ModelBuilderPage;
