// src/components/PumpDefinitionEditor/inputs/MultipointInput.tsx
import React from "react";
import type { MultipointPump, MultipointChangeHandler } from "../types/pump"; // Adjust path
import { Plus, MinusCircle } from "lucide-react"; // Keep icons where they are used

interface MultipointInputProps {
  pumpDefinition: MultipointPump;
  onPointChange: MultipointChangeHandler;
  onAddPoint: () => void;
  onDeletePoint: (index: number) => void;
}

const MultipointInput: React.FC<MultipointInputProps> = ({
  pumpDefinition,
  onPointChange,
  onAddPoint,
  onDeletePoint,
}) => {
  return (
    <div className="p-4 border rounded-md bg-white shadow-sm space-y-3">
      <p className="text-sm text-gray-600 italic">
        Enter flow/head pairs defining the pump curve. Points will be sorted for
        graphing.
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border text-left font-semibold text-gray-600 w-1/12">
              #
            </th>
            <th className="p-2 border text-left font-semibold text-gray-600">
              Flow (gpm)
            </th>
            <th className="p-2 border text-left font-semibold text-gray-600">
              Head (ft)
            </th>
            <th className="p-2 border text-center font-semibold text-gray-600 w-1/12">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {pumpDefinition.points.map((point, index) => (
            <tr key={index}>
              <td className="p-2 border text-center text-gray-500">
                {index + 1}
              </td>
              <td className="p-1 border">
                <input
                  type="number"
                  value={point.flow ?? ""}
                  onChange={(e) => onPointChange(index, "flow", e.target.value)}
                  className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Flow"
                  step="any"
                  min="0"
                />
              </td>
              <td className="p-1 border">
                <input
                  type="number"
                  value={point.head ?? ""}
                  onChange={(e) => onPointChange(index, "head", e.target.value)}
                  className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Head"
                  step="any"
                  min="0"
                />
              </td>
              <td className="p-1 border text-center">
                <button
                  onClick={() => onDeletePoint(index)}
                  title="Delete Row"
                  disabled={pumpDefinition.points.length <= 1}
                  className={`text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-150 p-1`} // Added padding
                >
                  <MinusCircle size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={onAddPoint}
        className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out flex items-center"
      >
        <Plus size={16} className="mr-1" /> Add Point
      </button>
    </div>
  );
};

export default MultipointInput;
