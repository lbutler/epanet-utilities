// src/components/PumpDefinitionEditor/inputs/MultipointInput.tsx
import React from "react";
// Keep existing imports: Point, Plus, MinusCircle etc.
import type { MultipointPump, PumpPoint } from "../types/pump"; // Adjust path
import { Plus, MinusCircle } from "lucide-react";

interface MultipointInputProps {
  pumpDefinition: MultipointPump;
  // Signature for onPointChange might need Point type keyof
  onPointChange: (index: number, field: keyof PumpPoint, value: string) => void;
  onSortPoints: () => void; // New prop for triggering sort
  onAddPoint: () => void;
  onDeletePoint: (index: number) => void;
}

const MultipointInput: React.FC<MultipointInputProps> = ({
  pumpDefinition,
  onPointChange,
  onSortPoints, // Use the new prop
  onAddPoint,
  onDeletePoint,
}) => {
  // Handler for blur on the FLOW input
  const handleFlowBlur = (
    event: React.FocusEvent<HTMLInputElement>,
    index: number
  ) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    // Check if focus is moving to the corresponding head input in the SAME row
    if (relatedTarget?.id !== `head-${index}`) {
      // If not moving to the head input (or moving out of the component), trigger sort
      onSortPoints();
    }
    // If it IS moving to head-${index}, do nothing, let the blur on head handle it later
  };

  // Handler for blur on the HEAD input (always triggers sort)
  const handleHeadBlur = () => {
    onSortPoints();
  };

  return (
    <div className="p-4 border rounded-md bg-white shadow-sm space-y-3">
      <p className="text-sm text-gray-600 italic">
        Enter flow/head pairs defining the pump curve. Points will be sorted
        when you navigate away from a row.
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          {/* Header remains the same */}
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
            <tr key={`point-${index}`}>
              {/* Prefer more stable keys if points have unique IDs */}
              <td className="p-2 border text-center text-gray-500">
                {index + 1}
              </td>
              <td className="p-1 border">
                <input
                  id={`flow-${index}`} // Add unique ID for flow
                  type="number"
                  value={point.flow ?? ""}
                  onChange={(e) => onPointChange(index, "flow", e.target.value)}
                  onBlur={(e) => handleFlowBlur(e, index)} // Add onBlur handler
                  className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Flow"
                  step="any"
                  min="0"
                />
              </td>
              <td className="p-1 border">
                <input
                  id={`head-${index}`} // Add unique ID for head
                  type="number"
                  value={point.head ?? ""}
                  onChange={(e) => onPointChange(index, "head", e.target.value)}
                  onBlur={handleHeadBlur} // Add onBlur handler (simpler logic)
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
