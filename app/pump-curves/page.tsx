"use client";

import React from "react";
import { PumpDefinitionEditor } from "@/components/PumpDefinitionEditor/index";

const PumpCurvesPage = () => {
  const handleSave = (data: {
    definition: PumpDefinition;
    fit: PumpCurveFitResult | null;
  }) => {
    console.log("Saved data:", data);
  };

  const handleClose = () => {
    console.log("Editor closed");
  };

  return <PumpDefinitionEditor onSave={handleSave} onClose={handleClose} />;
};

export default PumpCurvesPage;
