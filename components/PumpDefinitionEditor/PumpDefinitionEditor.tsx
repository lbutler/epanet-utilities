"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";

// Types
import type {
  PumpDefinition,
  PumpType,
  PumpPoint,
  MultipointPump,
  PumpCurveFitResult,
  ValidationResult,
  InputChangeHandler,
  MultipointChangeHandler,
} from "./types/pump"; // Adjust path

// Logic/Utils
import {
  fitPumpCurve,
  calculateOnePointCurvePoints,
  getThreePointRawData,
  validateThreePointCurve,
} from "./libs/pumpCurveLogic"; // Adjust path

// Sub-components
import PumpCurveGraph from "./PumpCurveGraph";
import ConstantPowerInput from "./inputs/ConstantPowerInput";
import OnePointInput from "./inputs/OnePointInput";
import ThreePointInput from "./inputs/ThreePointInput";
import MultipointInput from "./inputs/MultipointInput";

// Initial state for a new pump definition (e.g., multipoint default)
const initialPumpState: MultipointPump = {
  type: "multipoint",
  points: [{ flow: 0, head: null }], // Start with shutoff point row
};

// Props for the editor component (e.g., initial data, onSave callback)
interface PumpDefinitionEditorProps {
  initialData?: PumpDefinition;
  onSave: (data: {
    definition: PumpDefinition;
    fit: PumpCurveFitResult | null;
  }) => void;
  onClose: () => void;
}

const PumpDefinitionEditor: React.FC<PumpDefinitionEditorProps> = ({
  initialData = initialPumpState,
  onSave,
  onClose,
}) => {
  // --- State ---
  const [pumpDefinition, setPumpDefinition] =
    useState<PumpDefinition>(initialData);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: [],
  });
  const [fitResult, setFitResult] = useState<PumpCurveFitResult | null>(null);

  // --- Curve Fitting Effect ---
  useEffect(() => {
    let result: PumpCurveFitResult | null = null;
    let currentValidation: ValidationResult = { isValid: true, errors: [] };

    // 1. Perform Input Validation (currently only specific to 3-point)
    if (pumpDefinition.type === "threePoint") {
      currentValidation = validateThreePointCurve(pumpDefinition);
      setValidationResult(currentValidation); // Update validation state immediately

      // Only attempt fitting if input validation passes
      if (currentValidation.isValid) {
        const { shutoffHead, designPoint, maxOperatingPoint } = pumpDefinition;
        // Check if all required points are valid numbers before fitting
        if (
          typeof shutoffHead === "number" &&
          typeof designPoint.flow === "number" &&
          typeof designPoint.head === "number" &&
          typeof maxOperatingPoint.flow === "number" &&
          typeof maxOperatingPoint.head === "number"
        ) {
          const qValues = [0, designPoint.flow, maxOperatingPoint.flow];
          const hValues = [
            shutoffHead,
            designPoint.head,
            maxOperatingPoint.head,
          ];
          result = fitPumpCurve(3, qValues, hValues);
        } else {
          result = null; // Not enough valid data to fit yet
        }
      } else {
        result = null; // Input validation failed, no fit attempt
      }
    } else if (pumpDefinition.type === "onePoint") {
      setValidationResult({ isValid: true, errors: [] }); // Clear validation for non-3-point types
      const { designPoint } = pumpDefinition;
      // Check if design point is valid number before fitting
      if (
        typeof designPoint.flow === "number" &&
        typeof designPoint.head === "number" &&
        designPoint.flow > 0 && // Add basic check here before passing to fit
        designPoint.head > 0
      ) {
        result = fitPumpCurve(1, [designPoint.flow], [designPoint.head]);
      } else {
        result = null; // Not enough valid data to fit yet
      }
    } else {
      // For 'constantPower' or 'multipoint', clear validation and fit results
      setValidationResult({ isValid: true, errors: [] });
      result = null;
    }

    setFitResult(result); // Update fit result state
  }, [pumpDefinition]); // Re-run whenever the pump definition changes

  // --- Event Handlers ---

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as PumpType;
    let newPumpDefinition: PumpDefinition;

    // Reset to default structure for the selected type
    switch (newType) {
      case "constantPower":
        newPumpDefinition = { type: "constantPower", power: null };
        break;
      case "onePoint":
        newPumpDefinition = {
          type: "onePoint",
          designPoint: { flow: null, head: null },
        };
        break;
      case "threePoint":
        newPumpDefinition = {
          type: "threePoint",
          shutoffHead: null,
          designPoint: { flow: null, head: null },
          maxOperatingPoint: { flow: null, head: null },
        };
        break;
      case "multipoint":
      default: // Default to multipoint if something goes wrong
        newPumpDefinition = {
          type: "multipoint",
          points: [{ flow: 0, head: null }],
        };
        break;
    }

    setPumpDefinition(newPumpDefinition);
    setValidationResult({ isValid: true, errors: [] }); // Clear validation on type change
    setFitResult(null); // Clear fit result on type change
  };

  // Generic input handler for non-multipoint fields
  // Uses path strings like 'power', 'designPoint.flow'
  const handleInputChange: InputChangeHandler = useCallback(
    (fieldPath, value) => {
      const numValue = value === "" ? null : parseFloat(value);

      setPumpDefinition((prevDef) => {
        // Shallow copy is okay for the top level
        const updatedPumpDraft: PumpDefinition = { ...prevDef };

        // Update nested properties carefully
        const parts = fieldPath.split(".");
        let currentLevel: any = updatedPumpDraft;

        for (let i = 0; i < parts.length - 1; i++) {
          if (!currentLevel[parts[i]]) {
            currentLevel[parts[i]] = {}; // Create nested object if it doesn't exist
          }
          currentLevel = currentLevel[parts[i]];
        }

        // Assign the parsed number value (or null) to the final property
        // Only assign if it's a valid number or null (to avoid NaN issues)
        currentLevel[parts[parts.length - 1]] =
          numValue !== null && isNaN(numValue)
            ? currentLevel[parts[parts.length - 1]]
            : numValue;

        // Important: Return the modified draft
        return updatedPumpDraft;
      });
      // State update is async, validation/fitting happens in useEffect
    },
    []
  ); // No dependencies needed as it uses the updater function

  // --- Multipoint Specific Handlers ---
  const handleMultipointChange: MultipointChangeHandler = useCallback(
    (index, field, value) => {
      const numValue = value === "" ? null : parseFloat(value);

      setPumpDefinition((prevDef) => {
        if (prevDef.type !== "multipoint") return prevDef; // Type guard

        const updatedPoints = prevDef.points.map((point, i) => {
          if (i === index) {
            // Only assign if it's a valid number or null
            const assignValue =
              numValue !== null && isNaN(numValue) ? point[field] : numValue;
            return { ...point, [field]: assignValue };
          }
          return point;
        });

        return { ...prevDef, points: updatedPoints };
      });
    },
    []
  );

  const handleAddMultipointRow = useCallback(() => {
    setPumpDefinition((prevDef) => {
      if (prevDef.type !== "multipoint") return prevDef;
      // Add point with nulls
      return {
        ...prevDef,
        points: [...prevDef.points, { flow: null, head: null }],
      };
    });
  }, []);

  const handleDeleteMultipointRow = useCallback((index: number) => {
    setPumpDefinition((prevDef) => {
      if (prevDef.type !== "multipoint") return prevDef;
      // Prevent deleting the last row
      if (prevDef.points.length <= 1) return prevDef;

      const updatedPoints = prevDef.points.filter((_, i) => i !== index);
      return { ...prevDef, points: updatedPoints };
    });
  }, []);

  // --- Save Handler ---
  const handleInternalSave = () => {
    if (
      pumpDefinition.type === "multipoint" &&
      (fitResult?.success ||
        pumpDefinition.points.length == 3 ||
        pumpDefinition.points.length == 1)
    ) {
      const userChoice = window.confirm(
        "You have defined multiple points. Would you like to switch to a 1-point or 3-point curve?"
      );

      if (userChoice) {
        // Automatically switch to 3-point if enough points are defined
        if (pumpDefinition.points.length >= 3) {
          const [shutoffPoint, designPoint, maxOperatingPoint] =
            pumpDefinition.points.slice(0, 3);
          setPumpDefinition({
            type: "threePoint",
            shutoffHead: shutoffPoint.head,
            designPoint: { flow: designPoint.flow, head: designPoint.head },
            maxOperatingPoint: {
              flow: maxOperatingPoint.flow,
              head: maxOperatingPoint.head,
            },
          });
        } else {
          // Otherwise, switch to 1-point using the first point
          const designPoint = pumpDefinition.points[0];
          setPumpDefinition({
            type: "onePoint",
            designPoint: { flow: designPoint.flow, head: designPoint.head },
          });
        }
        return; // Exit early to allow the user to adjust the new definition
      }
    }

    // Perform final checks before calling the onSave prop
    if (!validationResult.isValid) {
      alert(
        `Cannot save: Please fix the input validation errors:\n- ${validationResult.errors.join(
          "\n- "
        )}`
      );
      return;
    }

    if (
      (pumpDefinition.type === "onePoint" ||
        pumpDefinition.type === "threePoint") &&
      fitResult &&
      !fitResult.success
    ) {
      // Allow saving even if fit fails? Or block? Let's block for now.
      alert(
        `Cannot save: Curve fitting failed for the provided points.\nError: ${fitResult.errorMessage}`
      );
      return;
    }
    if (
      (pumpDefinition.type === "onePoint" ||
        pumpDefinition.type === "threePoint") &&
      !fitResult // No fit result generated yet (likely due to incomplete input)
    ) {
      alert(
        `Cannot save: Please ensure all required points are entered correctly for the curve.`
      );
      return;
    }

    // Prepare data payload
    const dataToSave = {
      definition: pumpDefinition,
      // Include fit result only if successful
      fit: fitResult?.success ? fitResult : null,
    };

    console.log("Saving Pump Definition:", dataToSave);
    onSave(dataToSave); // Call the callback prop
  };

  // --- Graph Data Calculation ---
  const graphData = useMemo((): PumpPoint[] => {
    if (
      pumpDefinition.type === "onePoint" ||
      pumpDefinition.type === "threePoint"
    ) {
      // Prefer fitted curve data if available and successful
      if (
        fitResult?.success &&
        fitResult.curvePoints &&
        fitResult.curvePoints.length > 0
      ) {
        // Map fitted points {q, h} back to {flow, head}
        return fitResult.curvePoints.map((p) => ({ flow: p.q, head: p.h }));
      }
      // Fallback: Calculate raw points for display if fit fails or isn't ready
      else if (pumpDefinition.type === "onePoint") {
        // Use the calculation function that returns 3 points
        // Filter out nulls just before sending to graph if necessary
        const points = calculateOnePointCurvePoints(pumpDefinition.designPoint);
        return points; // Send array potentially containing nulls to graph
      } else {
        // ThreePoint
        // Use the raw data getter
        const points = getThreePointRawData(pumpDefinition);
        return points; // Send array potentially containing nulls to graph
      }
    } else if (pumpDefinition.type === "multipoint") {
      // Use user-defined points directly for multipoint
      // Graph component will handle filtering/sorting
      return pumpDefinition.points;
    }
    // No graph for constant power
    return [];
  }, [pumpDefinition, fitResult]);

  // --- Render Input Fields Dynamically ---
  const renderInputFields = () => {
    switch (pumpDefinition.type) {
      case "constantPower":
        return (
          <ConstantPowerInput
            pumpDefinition={pumpDefinition}
            onChange={handleInputChange}
          />
        );
      case "onePoint":
        return (
          <OnePointInput
            pumpDefinition={pumpDefinition}
            onChange={handleInputChange}
            fitResult={fitResult}
          />
        );
      case "threePoint":
        return (
          <ThreePointInput
            pumpDefinition={pumpDefinition}
            onChange={handleInputChange}
            validationErrors={validationResult.errors}
            fitResult={fitResult}
          />
        );
      case "multipoint":
        return (
          <MultipointInput
            pumpDefinition={pumpDefinition}
            onPointChange={handleMultipointChange}
            onAddPoint={handleAddMultipointRow}
            onDeletePoint={handleDeleteMultipointRow}
          />
        );
      default:
        // Should not happen with TypeScript, but good practice
        const _exhaustiveCheck: never = pumpDefinition;
        console.error(
          "Unhandled pump type in renderInputFields:",
          _exhaustiveCheck
        );
        return null;
    }
  };

  // --- Main Render ---
  return (
    <div className="p-6 bg-gray-100 rounded-lg shadow-xl max-w-2xl mx-auto my-8 font-sans">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Pump Definition Editor
      </h2>
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
            <option value="multipoint">Multiple Point</option>
            <option value="threePoint">Standard (3 Point)</option>
            <option value="onePoint">Design Point (1 point)</option>
            <option value="constantPower">Constant Power</option>
          </select>
        </div>

        {/* Definition Area (Inputs + Graph) */}
        <div className="flex-grow flex flex-col space-y-4">
          {renderInputFields()}

          {/* Conditionally render graph */}
          {(pumpDefinition.type === "onePoint" ||
            pumpDefinition.type === "threePoint" ||
            pumpDefinition.type === "multipoint") && (
            <div className="flex-grow p-4 border rounded-md bg-white shadow-sm min-h-[380px]">
              {" "}
              {/* Increased min height slightly */}
              <PumpCurveGraph
                data={graphData}
                multiPoint={pumpDefinition.type === "multipoint"}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose} // Use the onClose prop
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150 ease-in-out"
          >
            Close
          </button>
          <button
            onClick={handleInternalSave}
            // Disable save if validation fails OR if fit fails for types that require fitting
            disabled={
              !validationResult.isValid ||
              ((pumpDefinition.type === "onePoint" ||
                pumpDefinition.type === "threePoint") &&
                fitResult !== null &&
                !fitResult.success) ||
              ((pumpDefinition.type === "onePoint" ||
                pumpDefinition.type === "threePoint") &&
                fitResult === null) // Also disable if fit hasn't run (likely due to incomplete valid data)
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
          >
            Save Pump
          </button>
        </div>
      </div>
    </div>
  );
};

export default PumpDefinitionEditor;
