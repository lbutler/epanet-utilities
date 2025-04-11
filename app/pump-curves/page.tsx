"use client";

import React, { useState, useMemo } from "react";
// Import recharts components for graphing
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
// Import icons (using lucide-react as an example)
import { Plus, AlertCircle, MinusCircle } from "lucide-react"; // Removed unused icons

// --- TypeScript Interfaces ---

// Represents a single point on the pump curve
interface PumpPoint {
  flow: number | null;
  head: number | null;
}

// Represents the different types of pump data
type PumpType = "constantPower" | "onePoint" | "threePoint" | "multipoint";

// Base interface for all pump definitions (simplified, no ID/label needed for single instance)
interface PumpDefinitionBase {
  type: PumpType;
}

// Interface for Constant Power pump
interface ConstantPowerPump extends PumpDefinitionBase {
  type: "constantPower";
  power: number | null; // in kW
}

// Interface for 1-Point pump
interface OnePointPump extends PumpDefinitionBase {
  type: "onePoint";
  designPoint: PumpPoint;
}

// Interface for 3-Point pump
interface ThreePointPump extends PumpDefinitionBase {
  type: "threePoint";
  shutoffHead: number | null; // Flow is always 0
  designPoint: PumpPoint;
  maxOperatingPoint: PumpPoint;
}

// Interface for Multipoint pump
interface MultipointPump extends PumpDefinitionBase {
  type: "multipoint";
  points: PumpPoint[]; // Array of user-defined points
}

// Union type for any pump definition
type PumpDefinition =
  | ConstantPowerPump
  | OnePointPump
  | ThreePointPump
  | MultipointPump;

// Props for the graph component
interface PumpCurveGraphProps {
  data: { flow: number; head: number }[];
  // Removed pumpLabel prop
}

// Validation Result Type
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// --- Utility Functions ---

// Calculates points for the 1-point curve based on EPANET logic
const calculateOnePointCurve = (designPoint: PumpPoint): PumpPoint[] => {
  const designFlow = designPoint.flow ?? 0;
  const designHead = designPoint.head ?? 0;
  if (designFlow <= 0 || designHead <= 0) return [];
  const shutoffHead = designHead * 1.3333;
  const maxOperatingFlow = designFlow * 2;
  return [
    { flow: 0, head: shutoffHead },
    { flow: designFlow, head: designHead },
    { flow: maxOperatingFlow, head: 0 },
  ];
};

// Prepares data for the graph from a 3-point definition
const getThreePointCurveData = (pump: ThreePointPump): PumpPoint[] => {
  const points = [
    { flow: 0, head: pump.shutoffHead },
    { flow: pump.designPoint.flow, head: pump.designPoint.head },
    { flow: pump.maxOperatingPoint.flow, head: pump.maxOperatingPoint.head },
  ];
  const validPoints = points.filter(
    (p) =>
      p.flow !== null &&
      p.head !== null &&
      typeof p.flow === "number" &&
      typeof p.head === "number"
  );
  return validPoints.length >= 2
    ? (validPoints as { flow: number; head: number }[])
    : [];
};

// Validation Function for 3-Point Curve
const validateThreePointCurve = (pump: ThreePointPump): ValidationResult => {
  const errors: string[] = [];
  const { shutoffHead, designPoint, maxOperatingPoint } = pump;
  const pointsToCheck = [
    { value: shutoffHead, name: "Shutoff Head" },
    { value: designPoint.flow, name: "Design Flow" },
    { value: designPoint.head, name: "Design Head" },
    { value: maxOperatingPoint.flow, name: "Max Operating Flow" },
    { value: maxOperatingPoint.head, name: "Max Operating Head" },
  ];
  let allNumeric = true;
  pointsToCheck.forEach((p) => {
    if (p.value === null || typeof p.value !== "number" || isNaN(p.value)) {
      errors.push(`${p.name} must be a valid number.`);
      allNumeric = false;
    }
  });
  if (allNumeric) {
    if (maxOperatingPoint.flow! <= designPoint.flow!)
      errors.push("Max Operating Flow must be greater than Design Flow.");
    if (shutoffHead! <= designPoint.head!)
      errors.push("Shutoff Head must be greater than Design Head.");
    if (designPoint.head! <= maxOperatingPoint.head!)
      errors.push("Design Head must be greater than Max Operating Head.");
  }
  return { isValid: errors.length === 0, errors };
};

// --- React Components ---

// Pump Curve Graph Component (using Recharts) - Simplified props
const PumpCurveGraph: React.FC<PumpCurveGraphProps> = ({ data }) => {
  const validData = data
    .filter(
      (p) =>
        typeof p.flow === "number" &&
        typeof p.head === "number" &&
        !isNaN(p.flow) &&
        !isNaN(p.head)
    )
    .sort((a, b) => a.flow - b.flow);

  if (validData.length < 2) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md mt-4">
        <p className="text-center text-gray-500 italic">
          Enter at least two valid data points
          <br />
          to view the pump curve.
        </p>
      </div>
    );
  }

  const maxHead = Math.max(...validData.map((p) => p.head));
  const maxFlow = Math.max(...validData.map((p) => p.flow));

  return (
    <>
      {/* Static Title */}
      <h3 className="text-lg font-semibold mb-3 text-center text-gray-700">
        Pump Curve
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={validData}
          margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="flow"
            type="number"
            label={{
              value: "Flow (gpm)",
              position: "insideBottom",
              offset: -15,
            }}
            domain={[0, "auto"]}
            stroke="#6b7280"
            tickFormatter={(tick) => tick.toFixed(0)}
          />
          <YAxis
            dataKey="head"
            type="number"
            label={{
              value: "Head (ft)",
              angle: -90,
              position: "insideLeft",
              offset: -5,
            }}
            domain={[0, (dataMax) => Math.max(dataMax * 1.1, 10)]}
            stroke="#6b7280"
            tickFormatter={(tick) => tick.toFixed(1)}
          />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(2)}`, name]}
            labelFormatter={(label) => `Flow: ${Number(label).toFixed(2)} gpm`}
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              borderRadius: "8px",
              borderColor: "#cbd5e1",
            }}
          />
          <Legend verticalAlign="top" height={36} />
          <Line
            type="monotone"
            dataKey="head"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4, fill: "#3b82f6" }}
            activeDot={{ r: 6, stroke: "#1d4ed8" }}
            name="Head Curve"
          />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
};

// Main Modal Component - Simplified for single curve definition
const App: React.FC = () => {
  // --- State for the single pump definition ---
  const [pumpDefinition, setPumpDefinition] = useState<PumpDefinition>({
    // Initial default state (e.g., multipoint)
    type: "multipoint",
    points: [{ flow: 0, head: null }],
  });
  // State for validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // --- Event Handlers ---

  // Simplified update handler
  const handleUpdatePump = (updatedPump: PumpDefinition) => {
    // Perform validation if it's a 3-point pump
    if (updatedPump.type === "threePoint") {
      const validation = validateThreePointCurve(updatedPump as ThreePointPump);
      setValidationErrors(validation.errors);
    } else {
      setValidationErrors([]); // Clear errors for other types
    }
    setPumpDefinition(updatedPump); // Update the single pump definition state
  };

  // --- Input Change Handlers ---
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as PumpType;
    let newPumpDefinition: PumpDefinition;

    // Reset definition based on new type
    if (newType === "constantPower") {
      newPumpDefinition = { type: "constantPower", power: null };
    } else if (newType === "onePoint") {
      newPumpDefinition = {
        type: "onePoint",
        designPoint: { flow: null, head: null },
      };
    } else if (newType === "threePoint") {
      newPumpDefinition = {
        type: "threePoint",
        shutoffHead: null,
        designPoint: { flow: null, head: null },
        maxOperatingPoint: { flow: null, head: null },
      };
    } else if (newType === "multipoint") {
      newPumpDefinition = {
        type: "multipoint",
        points: [{ flow: 0, head: null }],
      };
    } else {
      // Should not happen with defined types, but good practice
      console.error("Unknown pump type selected");
      return;
    }

    setValidationErrors([]); // Clear errors on type change
    setPumpDefinition(newPumpDefinition); // Update state
  };

  // Generic input handler for non-multipoint fields
  const handleInputChange = (
    field:
      | keyof ConstantPowerPump
      | keyof OnePointPump
      | keyof ThreePointPump
      | string,
    value: string
  ) => {
    if (pumpDefinition.type === "multipoint") return; // Should not be called for multipoint

    const numValue = value === "" ? null : parseFloat(value);
    let updatedPumpDraft = { ...pumpDefinition }; // Work with the current single definition

    try {
      if (pumpDefinition.type === "constantPower" && field === "power") {
        (updatedPumpDraft as ConstantPowerPump).power = numValue;
      } else if (pumpDefinition.type === "onePoint") {
        const pointPump = updatedPumpDraft as OnePointPump;
        if (field === "designPoint.flow") pointPump.designPoint.flow = numValue;
        else if (field === "designPoint.head")
          pointPump.designPoint.head = numValue;
      } else if (pumpDefinition.type === "threePoint") {
        const pointPump = updatedPumpDraft as ThreePointPump;
        if (field === "shutoffHead") pointPump.shutoffHead = numValue;
        else if (field === "designPoint.flow")
          pointPump.designPoint.flow = numValue;
        else if (field === "designPoint.head")
          pointPump.designPoint.head = numValue;
        else if (field === "maxOperatingPoint.flow")
          pointPump.maxOperatingPoint.flow = numValue;
        else if (field === "maxOperatingPoint.head")
          pointPump.maxOperatingPoint.head = numValue;
      }
      handleUpdatePump(updatedPumpDraft); // Pass draft to update handler
    } catch (error) {
      console.error("Error updating pump state:", error);
    }
  };

  // --- Multipoint Specific Handlers ---
  const handleMultipointChange = (
    index: number,
    field: "flow" | "head",
    value: string
  ) => {
    if (pumpDefinition.type !== "multipoint") return;

    const numValue = value === "" ? null : parseFloat(value);
    const updatedPoints = (pumpDefinition as MultipointPump).points.map(
      (point, i) => {
        if (i === index) {
          return { ...point, [field]: numValue };
        }
        return point;
      }
    );

    handleUpdatePump({ ...pumpDefinition, points: updatedPoints });
  };

  const handleAddMultipointRow = () => {
    if (pumpDefinition.type !== "multipoint") return;
    const updatedPoints = [
      ...(pumpDefinition as MultipointPump).points,
      { flow: null, head: null },
    ];
    handleUpdatePump({ ...pumpDefinition, points: updatedPoints });
  };

  const handleDeleteMultipointRow = (index: number) => {
    if (pumpDefinition.type !== "multipoint") return;
    const currentPoints = (pumpDefinition as MultipointPump).points;
    if (currentPoints.length <= 1) {
      console.warn("Cannot delete the last row.");
      return;
    }
    const updatedPoints = currentPoints.filter((_, i) => i !== index);
    handleUpdatePump({ ...pumpDefinition, points: updatedPoints });
  };

  // --- Save Handler ---
  const handleSave = () => {
    console.log("Saving Pump Definition:", pumpDefinition);
    // In a real application, you would pass this data up to a parent component
    // or send it to an API.
    // Example: props.onSave(pumpDefinition);

    // Check for validation errors before declaring save successful
    if (pumpDefinition.type === "threePoint") {
      const validation = validateThreePointCurve(
        pumpDefinition as ThreePointPump
      );
      if (!validation.isValid) {
        alert("Cannot save: Please fix the validation errors.");
        setValidationErrors(validation.errors); // Ensure errors are shown
        return;
      }
    }

    alert("Pump definition saved! (Check console for data)");
  };

  // --- Render Logic ---

  // Calculate points for graph based on selected pump type
  const graphData = useMemo(() => {
    if (!pumpDefinition) return [];
    if (pumpDefinition.type === "onePoint") {
      return calculateOnePointCurve(pumpDefinition.designPoint);
    } else if (
      pumpDefinition.type === "threePoint" &&
      validationErrors.length === 0
    ) {
      return getThreePointCurveData(pumpDefinition);
    } else if (pumpDefinition.type === "multipoint") {
      return (pumpDefinition as MultipointPump).points
        .filter(
          (p) =>
            p.flow !== null &&
            p.head !== null &&
            typeof p.flow === "number" &&
            typeof p.head === "number" &&
            !isNaN(p.flow) &&
            !isNaN(p.head)
        )
        .sort((a, b) => a.flow! - b.flow!) as { flow: number; head: number }[];
    }
    return [];
  }, [pumpDefinition, validationErrors]); // Depend on the single definition and errors

  // Render input fields based on type
  const renderInputFields = () => {
    if (!pumpDefinition) return null; // Should not happen with default state

    switch (pumpDefinition.type) {
      case "constantPower":
        return (
          <div className="space-y-3 p-4 border rounded-md bg-white shadow-sm">
            <label className="flex items-center space-x-3">
              <span className="font-medium text-gray-700 w-28">
                Pump Power:
              </span>
              <input
                type="number"
                value={(pumpDefinition as ConstantPowerPump).power ?? ""}
                onChange={(e) => handleInputChange("power", e.target.value)}
                className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                placeholder="e.g., 7.5"
              />
              <span className="text-gray-600 ml-2">kW</span>
            </label>
          </div>
        );

      case "onePoint": {
        const pump = pumpDefinition as OnePointPump;
        const calculatedPoints = calculateOnePointCurve(pump.designPoint);
        const [shutoff, design, maxOp] =
          calculatedPoints.length === 3
            ? calculatedPoints
            : [
                { flow: 0, head: null },
                { flow: pump.designPoint.flow, head: pump.designPoint.head },
                { flow: null, head: 0 },
              ];
        return (
          <div className="p-4 border rounded-md bg-white shadow-sm">
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
                    Shutoff:
                  </td>
                  <td className="p-2 border text-gray-800">
                    <input
                      type="number"
                      value={shutoff.flow ?? 0}
                      readOnly
                      className="w-full p-1 bg-gray-100 border-none rounded"
                    />
                  </td>
                  <td className="p-2 border text-gray-800">
                    <input
                      type="number"
                      value={shutoff.head?.toFixed(2) ?? ""}
                      readOnly
                      className="w-full p-1 bg-gray-100 border-none rounded"
                      placeholder="Calc."
                    />
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border font-medium text-gray-700">
                    Design:
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={pump.designPoint.flow ?? ""}
                      onChange={(e) =>
                        handleInputChange("designPoint.flow", e.target.value)
                      }
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="e.g., 100"
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={pump.designPoint.head ?? ""}
                      onChange={(e) =>
                        handleInputChange("designPoint.head", e.target.value)
                      }
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="e.g., 10"
                    />
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="p-2 border font-medium text-gray-700">
                    Max. Operating:
                  </td>
                  <td className="p-2 border text-gray-800">
                    <input
                      type="number"
                      value={maxOp.flow?.toFixed(2) ?? ""}
                      readOnly
                      className="w-full p-1 bg-gray-100 border-none rounded"
                      placeholder="Calc."
                    />
                  </td>
                  <td className="p-2 border text-gray-800">
                    <input
                      type="number"
                      value={maxOp.head ?? 0}
                      readOnly
                      className="w-full p-1 bg-gray-100 border-none rounded"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }

      case "threePoint": {
        const pump = pumpDefinition as ThreePointPump;
        return (
          <div className="p-4 border rounded-md bg-white shadow-sm space-y-3">
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
                  <td className="p-2 border font-medium text-gray-700">
                    Shutoff:
                  </td>
                  <td className="p-2 border bg-gray-100">
                    <input
                      type="number"
                      value={0}
                      readOnly
                      className="w-full p-1 bg-gray-100 border-none rounded"
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={pump.shutoffHead ?? ""}
                      onChange={(e) =>
                        handleInputChange("shutoffHead", e.target.value)
                      }
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="e.g., 13"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border font-medium text-gray-700">
                    Design:
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={pump.designPoint.flow ?? ""}
                      onChange={(e) =>
                        handleInputChange("designPoint.flow", e.target.value)
                      }
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="e.g., 100"
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={pump.designPoint.head ?? ""}
                      onChange={(e) =>
                        handleInputChange("designPoint.head", e.target.value)
                      }
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="e.g., 10"
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
                      value={pump.maxOperatingPoint.flow ?? ""}
                      onChange={(e) =>
                        handleInputChange(
                          "maxOperatingPoint.flow",
                          e.target.value
                        )
                      }
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="e.g., 200"
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={pump.maxOperatingPoint.head ?? ""}
                      onChange={(e) =>
                        handleInputChange(
                          "maxOperatingPoint.head",
                          e.target.value
                        )
                      }
                      className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                      placeholder="e.g., 0"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            {validationErrors.length > 0 && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 space-y-1">
                <p className="font-semibold flex items-center">
                  <AlertCircle size={16} className="mr-1.5" />
                  Validation Errors:
                </p>
                <ul className="list-disc list-inside pl-2">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }
      case "multipoint": {
        const pump = pumpDefinition as MultipointPump;
        return (
          <div className="p-4 border rounded-md bg-white shadow-sm space-y-3">
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
                {pump.points.map((point, index) => (
                  <tr key={index}>
                    <td className="p-2 border text-center text-gray-500">
                      {index + 1}
                    </td>
                    <td className="p-1 border">
                      <input
                        type="number"
                        value={point.flow ?? ""}
                        onChange={(e) =>
                          handleMultipointChange(index, "flow", e.target.value)
                        }
                        className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                        placeholder="Flow"
                      />
                    </td>
                    <td className="p-1 border">
                      <input
                        type="number"
                        value={point.head ?? ""}
                        onChange={(e) =>
                          handleMultipointChange(index, "head", e.target.value)
                        }
                        className="w-full p-1 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                        placeholder="Head"
                      />
                    </td>
                    <td className="p-1 border text-center">
                      <button
                        onClick={() => handleDeleteMultipointRow(index)}
                        title="Delete Row"
                        disabled={pump.points.length <= 1}
                        className={`text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150`}
                      >
                        <MinusCircle size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={handleAddMultipointRow}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out flex items-center"
            >
              <Plus size={16} className="mr-1" /> Add Point
            </button>
          </div>
        );
      }
      default:
        // Exhaustive check pattern
        const _exhaustiveCheck: never = pumpDefinition;
        console.error("Unhandled pump type:", _exhaustiveCheck);
        return null;
    }
  };

  return (
    // Simplified layout - removed outer flex, only render the definition panel
    <div className="p-6 bg-gray-100 rounded-lg shadow-xl max-w-2xl mx-auto my-8 font-sans">
      {" "}
      {/* Adjusted max-width */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Pump Definition
      </h2>{" "}
      {/* Simplified title */}
      {/* Definition Panel */}
      <div className="w-full flex flex-col">
        {/* Pump Type Selector */}
        <div className="mb-4 flex items-center space-x-3">
          <label
            htmlFor="pumpTypeSelect"
            className="font-medium text-gray-700 whitespace-nowrap"
          >
            Pump Definition Type:
          </label>
          <select
            id="pumpTypeSelect"
            value={pumpDefinition.type}
            onChange={handleTypeChange}
            className={`flex-grow p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out`}
          >
            <option value="constantPower">Constant Power</option>
            <option value="onePoint">Design Point (1 point)</option>
            <option value="threePoint">Standard (3 Point)</option>
            <option value="multipoint">Multiple Point</option>
          </select>
        </div>

        {/* Definition Area (Inputs + Graph) */}
        <div className="flex-grow flex flex-col space-y-4">
          {/* Input Fields Section */}
          {renderInputFields()}

          {/* Graph Section - Rendered for point-based types */}
          {(pumpDefinition.type === "onePoint" ||
            pumpDefinition.type === "threePoint" ||
            pumpDefinition.type === "multipoint") && (
            <div className="flex-grow p-4 border rounded-md bg-white shadow-sm min-h-[350px]">
              <PumpCurveGraph data={graphData} /> {/* Removed pumpLabel prop */}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            // onClick={handleClose} // Add close handler if needed
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150 ease-in-out"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={validationErrors.length > 0} // Disable if validation errors exist
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default App; // Export the main component
