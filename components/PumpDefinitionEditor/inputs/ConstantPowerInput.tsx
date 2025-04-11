import React from "react";
import type { ConstantPowerPump, InputChangeHandler } from "../types/pump"; // Adjust path

interface ConstantPowerInputProps {
  pumpDefinition: ConstantPowerPump;
  onChange: InputChangeHandler;
}

const ConstantPowerInput: React.FC<ConstantPowerInputProps> = ({
  pumpDefinition,
  onChange,
}) => {
  return (
    <div className="space-y-3 p-4 border rounded-md bg-white shadow-sm">
      <label className="flex items-center space-x-3">
        <span className="font-medium text-gray-700 w-28">Pump Power:</span>
        <input
          type="number"
          value={pumpDefinition.power ?? ""}
          onChange={(e) => onChange("power", e.target.value)}
          className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
          placeholder="e.g., 7.5"
          step="any" // Allow decimals
          min="0" // Power cannot be negative
        />
        <span className="text-gray-600 ml-2">kW</span>
      </label>
    </div>
  );
};

export default ConstantPowerInput;
