// src/components/PumpDefinitionEditor/inputs/ThreePointInput.tsx
import React from "react";
import type {
  ThreePointPump,
  InputChangeHandler,
  PumpCurveFitResult,
} from "../types/pump"; // Adjust path
import { AlertCircle } from "lucide-react"; // Keep icons where they are used
import FitResultDisplay from "./FitResultDisplay";

interface ThreePointInputProps {
  pumpDefinition: ThreePointPump;
  onChange: InputChangeHandler; // Handles 'shutoffHead', 'designPoint.*', 'maxOperatingPoint.*'
  validationErrors: string[];
  fitResult: PumpCurveFitResult | null;
}

const ThreePointInput: React.FC<ThreePointInputProps> = ({
  pumpDefinition,
  onChange,
  validationErrors,
  fitResult,
}) => {
  const allInputsFilled =
    pumpDefinition.shutoffHead != null && // Check shutoff head
    pumpDefinition.designPoint.flow != null && // Check design flow
    pumpDefinition.designPoint.head != null && // Check design head
    pumpDefinition.maxOperatingPoint.flow != null && // Check max op flow
    pumpDefinition.maxOperatingPoint.head != null; // Check max op head

  return (
    <div className="p-4 border rounded-md bg-white shadow-sm space-y-3">
      <p className="text-sm text-gray-600 italic">
        Enter the shutoff head (flow=0), design point, and max operating point.
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border text-left font-semibold text-gray-600 w-1/3">
              Point
            </th>
            <th className="p-2 border text-left font-semibold text-gray-600">
              Flow (gpm)
            </th>
            <th className="p-2 border text-left font-semibold text-gray-600">
              Head (ft)
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-2 border font-medium text-gray-700">Shutoff:</td>
            <td className="p-2 border bg-gray-100">
              <input
                type="number"
                value={0}
                readOnly
                className="w-full p-1 bg-gray-100 border-none rounded cursor-default"
              />
            </td>
            <td className="p-2 border">
              <input
                type="number"
                value={pumpDefinition.shutoffHead ?? ""}
                onChange={(e) => onChange("shutoffHead", e.target.value)}
                className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                placeholder="e.g., 13"
                step="any"
                min="0"
              />
            </td>
          </tr>
          <tr>
            <td className="p-2 border font-medium text-gray-700">Design:</td>
            <td className="p-2 border">
              <input
                type="number"
                value={pumpDefinition.designPoint.flow ?? ""}
                onChange={(e) => onChange("designPoint.flow", e.target.value)}
                className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                placeholder="e.g., 100"
                step="any"
                min="0" // Design flow usually > 0, validation handles this
              />
            </td>
            <td className="p-2 border">
              <input
                type="number"
                value={pumpDefinition.designPoint.head ?? ""}
                onChange={(e) => onChange("designPoint.head", e.target.value)}
                className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                placeholder="e.g., 10"
                step="any"
                min="0"
              />
            </td>
          </tr>
          <tr>
            <td className="p-2 border font-medium text-gray-700">
              Max. Operating:
            </td>
            <td className="p-2 border">
              <input
                type="number"
                value={pumpDefinition.maxOperatingPoint.flow ?? ""}
                onChange={(e) =>
                  onChange("maxOperatingPoint.flow", e.target.value)
                }
                className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                placeholder="e.g., 200"
                step="any"
                min="0"
              />
            </td>
            <td className="p-2 border">
              <input
                type="number"
                value={pumpDefinition.maxOperatingPoint.head ?? ""}
                onChange={(e) =>
                  onChange("maxOperatingPoint.head", e.target.value)
                }
                className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                placeholder="e.g., 0"
                step="any"
                min="0" // Can be 0
              />
            </td>
          </tr>
        </tbody>
      </table>
      {allInputsFilled && validationErrors.length > 0 && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 space-y-1">
          <p className="font-semibold flex items-center">
            <AlertCircle size={16} className="mr-1.5 flex-shrink-0" />
            Input Validation Errors:
          </p>
          <ul className="list-disc list-inside pl-2">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <FitResultDisplay fitResult={fitResult} />
    </div>
  );
};

export default ThreePointInput;
