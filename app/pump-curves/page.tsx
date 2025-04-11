"use client";

import React from "react";
import { PumpDefinitionEditor } from "@/components/PumpDefinitionEditor/index";

const PumpCurvesPage = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSave = (data: any) => {
    console.log("Saved data:", data);
  };

  const handleClose = () => {
    console.log("Editor closed");
  };

  return <PumpDefinitionEditor onSave={handleSave} onClose={handleClose} />;
};

export default PumpCurvesPage;
