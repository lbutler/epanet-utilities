// src/components/PumpDefinitionEditor/inputs/FitResultDisplay.tsx
import React from "react";
import type { PumpCurveFitResult } from "../types/pump"; // Adjust path

interface FitResultDisplayProps {
  fitResult: PumpCurveFitResult | null;
}

const FitResultDisplay: React.FC<FitResultDisplayProps> = ({ fitResult }) => {
  if (!fitResult) {
    return null; // Don't render if no fit result exists
  }

  return (
    <div className="mt-3 p-3 border rounded-md bg-gray-50 text-sm">
      <span className="font-semibold text-gray-700">
        Fitted Curve Equation (h = A - B*q^C):
      </span>
      {fitResult.success ? (
        <code className="block mt-1 text-gray-800 bg-gray-100 p-2 rounded break-words whitespace-pre-wrap">
          {fitResult.equation || "N/A"}
          {/* Optionally display A, B, C values too */}
          {/* <span className="block text-xs text-gray-600 mt-1">
                A={fitResult.A?.toFixed(4)}, B={fitResult.B?.toExponential(4)}, C={fitResult.C?.toFixed(4)}
            </span> */}
        </code>
      ) : (
        <p className="mt-1 text-red-600">
          <span className="font-semibold">Fit Error:</span>{" "}
          {fitResult.errorMessage || "Unknown error"}
        </p>
      )}
    </div>
  );
};

export default FitResultDisplay;
