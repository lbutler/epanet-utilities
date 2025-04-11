// src/components/PumpDefinitionEditor/inputs/OnePointInput.tsx
import React, { useMemo } from "react";
import type {
  OnePointPump,
  InputChangeHandler,
  PumpCurveFitResult,
} from "../types/pump"; // Adjust path
import { calculateOnePointCurvePoints } from "../libs/pumpCurveLogic";
import FitResultDisplay from "./FitResultDisplay";

interface OnePointInputProps {
  pumpDefinition: OnePointPump;
  onChange: InputChangeHandler; // Handles 'designPoint.flow', 'designPoint.head'
  fitResult: PumpCurveFitResult | null;
}

const OnePointInput: React.FC<OnePointInputProps> = ({
  pumpDefinition,
  onChange,
  fitResult,
}) => {
  // Calculate derived points for display
  const calculatedPoints = useMemo(() => {
    return calculateOnePointCurvePoints(pumpDefinition.designPoint);
  }, [pumpDefinition]);

  const [shutoff, , maxOp] = calculatedPoints;

  return (
    <div className="p-4 border rounded-md bg-white shadow-sm space-y-3">
      <p className="text-sm text-gray-600 italic">
        Enter the pump&apos;s design operating point. Shutoff and max flow
        points will be estimated.
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
          <tr className="bg-gray-50">
            <td className="p-2 border font-medium text-gray-700">
              Shutoff (Est.):
            </td>
            <td className="p-2 border text-gray-800">
              <input
                type="number"
                value={shutoff.flow ?? 0}
                readOnly
                className="w-full p-1 bg-gray-100 border-none rounded cursor-default"
              />
            </td>
            <td className="p-2 border text-gray-800">
              <input
                type="number"
                value={shutoff.head?.toFixed(2) ?? ""}
                readOnly
                className="w-full p-1 bg-gray-100 border-none rounded cursor-default"
                placeholder="Calc."
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
                min="0"
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
          <tr className="bg-gray-50">
            <td className="p-2 border font-medium text-gray-700">
              Max. Flow (Est.):
            </td>
            <td className="p-2 border text-gray-800">
              <input
                type="number"
                value={maxOp.flow?.toFixed(2) ?? ""}
                readOnly
                className="w-full p-1 bg-gray-100 border-none rounded cursor-default"
                placeholder="Calc."
              />
            </td>
            <td className="p-2 border text-gray-800">
              <input
                type="number"
                value={maxOp.head ?? 0}
                readOnly
                className="w-full p-1 bg-gray-100 border-none rounded cursor-default"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <FitResultDisplay fitResult={fitResult} />
    </div>
  );
};

export default OnePointInput;
