"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
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
import { Plus, AlertCircle, MinusCircle } from "lucide-react";

// --- TypeScript Interfaces ---

// Represents a single point on the pump curve
interface PumpPoint {
  flow: number | null;
  head: number | null;
}

// Represents the different types of pump data
type PumpType = "constantPower" | "onePoint" | "threePoint" | "multipoint";

// Base interface for all pump definitions
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
}

// Validation Result Type
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// --- EPANET Curve Fitting Logic ---

/**
 * Interface for the result of the pump curve fitting function.
 */
interface PumpCurveFitResult {
  success: boolean;
  A?: number; // Shutoff Head (h at q=0)
  B?: number; // Head loss coefficient (positive for valid curve)
  C?: number; // Head loss exponent
  equation?: string; // Formatted equation string: h = A - B*q^C
  curvePoints?: { q: number; h: number }[]; // Optional generated points along the curve
  errorMessage?: string; // Description of error if success is false
}

/**
 * Fits pump curve data to the equation hG = A - B*q^C using the iterative
 * method found in the EPANET GUI code.
 *
 * @param nPoints Number of input points (1 or 3).
 * @param qValues Array of flow values (X-coordinates).
 * If nPoints=1, expects [q_design].
 * If nPoints=3, expects [q_low, q_design, q_max].
 * @param hValues Array of head values (Y-coordinates).
 * If nPoints=1, expects [h_design].
 * If nPoints=3, expects [h_low, h_design, h_max].
 * @param numGeneratedPoints Optional number of points to generate for the curvePoints array. Defaults to 25.
 * @returns PumpCurveFitResult object containing the fit results or an error message.
 */
function fitPumpCurve(
  nPoints: number,
  qValues: number[],
  hValues: number[],
  numGeneratedPoints: number = 25
): PumpCurveFitResult {
  const TINY = 1e-6; // Small number for floating point comparisons
  const MAX_ITER = 5; // Maximum iterations for convergence
  const CONVERGENCE_TOLERANCE = 0.01; // Tolerance for A convergence

  let q0: number, h0: number, q1: number, h1: number, q2: number, h2: number;

  // --- 1. Determine the three defining points ---
  if (nPoints === 1) {
    if (qValues.length < 1 || hValues.length < 1) {
      return {
        success: false,
        errorMessage:
          "Insufficient data for 1-point curve. Requires 1 flow and 1 head value.",
      };
    }
    q1 = qValues[0];
    h1 = hValues[0];
    if (q1 <= TINY || h1 <= TINY) {
      return {
        success: false,
        errorMessage:
          "Design flow and head must be positive for 1-point curve generation.",
      };
    }
    q0 = 0.0;
    h0 = 1.33334 * h1; // Calculated Shutoff Head
    q2 = 2.0 * q1; // Calculated Max Flow
    h2 = 0.0; // Head at Max Flow is zero
  } else if (nPoints === 3) {
    if (qValues.length < 3 || hValues.length < 3) {
      return {
        success: false,
        errorMessage:
          "Insufficient data for 3-point curve. Requires 3 flow and 3 head values.",
      };
    }
    q0 = qValues[0];
    h0 = hValues[0];
    q1 = qValues[1];
    h1 = hValues[1];
    q2 = qValues[2];
    h2 = hValues[2];
  } else {
    return {
      success: false,
      errorMessage:
        "Invalid number of points specified. Only 1 or 3 points are supported.",
    };
  }

  // --- 2. Validate input points ---
  if (
    h0 - h1 < -TINY ||
    h1 - h2 < -TINY ||
    q1 - q0 < -TINY ||
    q2 - q1 < -TINY ||
    h0 < 0 ||
    h1 < 0 ||
    h2 < 0 ||
    q0 < 0 ||
    q1 < 0 ||
    q2 < 0
  ) {
    return {
      success: false,
      errorMessage:
        "Input points do not form a valid pump curve shape (Head must decrease/stay same, Flow must increase/stay same, all values non-negative).",
    };
  }
  if (Math.abs(q2 - q1) < TINY) {
    return {
      success: false,
      errorMessage:
        "Flow points q1 and q2 are too close together for calculation.",
    };
  }

  // --- 3. Initialize Iteration Variables ---
  let a: number = h0; // Initial guess for A (Shutoff Head)
  let bInternal: number = 0.0; // Represents '-B' from the Pascal code logic
  let c: number = 1.0; // Initial guess for C
  let converged: boolean = false;

  // --- 4. Iterative Fitting Process ---
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const h4 = a - h1; // Corresponds to B*q1^C
    const h5 = a - h2; // Corresponds to B*q2^C

    if (h4 <= TINY || h5 <= TINY || q1 < TINY) {
      break;
    }
    const ratio_q = q2 / q1;
    const ratio_h = h5 / h4;

    if (Math.abs(ratio_q - 1.0) < TINY || ratio_q <= 0 || ratio_h <= 0) {
      break;
    }

    try {
      c = Math.log(ratio_h) / Math.log(ratio_q);
    } catch (e) {
      break;
    }

    if (c <= 0.0 || c > 20.0) {
      break;
    }

    let q1_pow_c: number;
    try {
      q1_pow_c = Math.pow(q1, c);
    } catch (e) {
      break;
    }

    if (Math.abs(q1_pow_c) < TINY) {
      if (Math.abs(h4) > TINY) {
        break;
      } else {
        break;
      }
    }
    bInternal = -h4 / q1_pow_c;

    if (bInternal > TINY) {
      break;
    }

    let a1: number;
    if (q0 < TINY) {
      a1 = h0;
    } else {
      try {
        a1 = h0 - bInternal * Math.pow(q0, c);
      } catch (e) {
        break;
      }
    }

    if (Math.abs(a1 - a) < CONVERGENCE_TOLERANCE) {
      a = a1;
      converged = true;
      break;
    }
    a = a1;
  } // End of iteration loop

  // --- 5. Prepare and Return Result ---
  if (converged) {
    const B = -bInternal;
    if (B < 0) {
      return {
        success: false,
        errorMessage:
          "Fit resulted in a negative B coefficient (invalid curve shape).",
      };
    }

    const equation = `Head = ${a.toFixed(4)} - ${B.toExponential(
      4
    )} * (Flow)^${c.toFixed(4)}`;
    const curvePoints: { q: number; h: number }[] = [];
    let qMaxTheoretical = 0;

    if (B > TINY && c !== 0 && a > 0) {
      try {
        qMaxTheoretical = Math.pow(a / B, 1.0 / c);
      } catch (e) {
        qMaxTheoretical = q2;
      }
    } else if (a <= TINY) {
      qMaxTheoretical = 0;
    } else {
      qMaxTheoretical = q2;
    }

    const plotQmax = Math.max(qMaxTheoretical, q2, q1);

    if (plotQmax <= TINY) {
      const finalH = Math.max(0, a);
      if (isFinite(finalH)) {
        curvePoints.push({ q: 0, h: finalH });
      }
    } else {
      const dq = plotQmax / Math.max(1, numGeneratedPoints - 1);
      for (let i = 0; i < numGeneratedPoints; i++) {
        const q = i * dq;
        let h_calc: number;
        if (q < TINY) {
          h_calc = a;
        } else {
          try {
            h_calc = a - B * Math.pow(q, c);
          } catch (e) {
            h_calc = -Infinity;
          }
        }
        const finalH = Math.max(0, h_calc); // Ensure non-negative
        // ** Ensure point is finite before adding **
        if (isFinite(finalH) && isFinite(q)) {
          curvePoints.push({ q: q, h: finalH });
        } else {
          // Optionally log or handle non-finite points
          // console.warn(`Skipping point generation for q=${q} due to non-finite head calculation.`);
          // Push a fallback like {q: q, h: 0} if absolutely necessary, but skipping might be cleaner
        }
      }
      // Ensure the theoretical max flow point is added if valid and not already covered
      if (
        qMaxTheoretical > TINY &&
        isFinite(qMaxTheoretical) &&
        (!curvePoints.length ||
          curvePoints[curvePoints.length - 1].q < qMaxTheoretical - TINY)
      ) {
        curvePoints.push({ q: qMaxTheoretical, h: 0 });
      }
    }

    // Final check if enough points were generated
    if (curvePoints.length < 2) {
      // Even if converged, point generation failed. Return success=false? Or let caller handle fallback?
      // Let's return success=true but the caller (graphData) will see curvePoints is too short and fall back.
      console.warn(
        "Fit converged but failed to generate sufficient curve points."
      );
    }

    return {
      success: true,
      A: a,
      B: B,
      C: c,
      equation: equation,
      curvePoints: curvePoints,
    };
  } else {
    let errorMessage = "Fitting algorithm did not converge.";
    if (c <= 0.0) errorMessage = "Fit failed: Exponent C became non-positive.";
    if (c > 20.0)
      errorMessage = "Fit failed: Exponent C became too large (> 20).";
    if (bInternal > TINY)
      errorMessage =
        "Fit failed: Coefficient B became negative (invalid curve shape).";
    return { success: false, errorMessage: errorMessage };
  }
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

// Prepares data for the graph from a 3-point definition (used as fallback if fit fails)
const getThreePointRawData = (pump: ThreePointPump): PumpPoint[] => {
  const points = [
    { flow: 0, head: pump.shutoffHead },
    { flow: pump.designPoint.flow, head: pump.designPoint.head },
    { flow: pump.maxOperatingPoint.flow, head: pump.maxOperatingPoint.head },
  ];
  // Filter nulls but don't sort here, let graph component handle sorting
  return points.filter(
    (p) =>
      p.flow !== null &&
      p.head !== null &&
      typeof p.flow === "number" &&
      typeof p.head === "number"
  ) as PumpPoint[];
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
  // Sort data by flow for correct line drawing
  const validData = data
    .filter(
      (p) =>
        typeof p.flow === "number" &&
        typeof p.head === "number" &&
        !isNaN(p.flow) &&
        !isNaN(p.head) &&
        isFinite(p.flow) &&
        isFinite(p.head)
    ) // Added isFinite checks
    .sort((a, b) => a.flow - b.flow);

  // Check if we have enough valid points to draw a line
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

  const maxHead = Math.max(0, ...validData.map((p) => p.head)); // Ensure maxHead is not negative
  const maxFlow = Math.max(0, ...validData.map((p) => p.flow)); // Ensure maxFlow is not negative

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
            allowDataOverflow={false}
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
            dot={false}
            activeDot={false}
            name="Head Curve"
            isAnimationActive={false}
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
    type: "multipoint",
    points: [{ flow: 0, head: null }],
  });
  // State for validation errors (specific to 3-point for now)
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  // State for curve fitting result
  const [fitResult, setFitResult] = useState<PumpCurveFitResult | null>(null);

  // --- Effect to run curve fitting when pump definition changes ---
  useEffect(() => {
    let result: PumpCurveFitResult | null = null;
    if (pumpDefinition.type === "onePoint") {
      const { designPoint } = pumpDefinition;
      if (
        designPoint.flow !== null &&
        designPoint.head !== null &&
        typeof designPoint.flow === "number" &&
        typeof designPoint.head === "number"
      ) {
        result = fitPumpCurve(1, [designPoint.flow], [designPoint.head]);
      }
    } else if (pumpDefinition.type === "threePoint") {
      const { shutoffHead, designPoint, maxOperatingPoint } = pumpDefinition;
      if (
        shutoffHead !== null &&
        typeof shutoffHead === "number" &&
        designPoint.flow !== null &&
        typeof designPoint.flow === "number" &&
        designPoint.head !== null &&
        typeof designPoint.head === "number" &&
        maxOperatingPoint.flow !== null &&
        typeof maxOperatingPoint.flow === "number" &&
        maxOperatingPoint.head !== null &&
        typeof maxOperatingPoint.head === "number"
      ) {
        const qValues = [0, designPoint.flow, maxOperatingPoint.flow];
        const hValues = [shutoffHead, designPoint.head, maxOperatingPoint.head];
        result = fitPumpCurve(3, qValues, hValues);

        // Update validation errors based *only* on fit result if input validation passed
        if (validationErrors.length === 0 && result && !result.success) {
          setValidationErrors([result.errorMessage || "Curve fitting failed."]);
        }
      }
    }
    console.log("results:", result);
    setFitResult(result); // Update fit result state

    // Rerun fit if definition changes. We don't depend on validationErrors here directly,
    // handleUpdatePump clears/sets it, and then this effect runs with the latest pumpDefinition.
  }, [pumpDefinition]);

  // --- Event Handlers ---

  // Simplified update handler
  const handleUpdatePump = (updatedPump: PumpDefinition) => {
    if (updatedPump.type === "threePoint") {
      const validation = validateThreePointCurve(updatedPump as ThreePointPump);
      setValidationErrors(validation.errors);
    } else {
      setValidationErrors([]);
    }
    setPumpDefinition(updatedPump);
    // Fit calculation is now handled by the useEffect hook
  };

  // --- Input Change Handlers ---
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as PumpType;
    let newPumpDefinition: PumpDefinition;

    if (newType === "constantPower")
      newPumpDefinition = { type: "constantPower", power: null };
    else if (newType === "onePoint")
      newPumpDefinition = {
        type: "onePoint",
        designPoint: { flow: null, head: null },
      };
    else if (newType === "threePoint")
      newPumpDefinition = {
        type: "threePoint",
        shutoffHead: null,
        designPoint: { flow: null, head: null },
        maxOperatingPoint: { flow: null, head: null },
      };
    else if (newType === "multipoint")
      newPumpDefinition = {
        type: "multipoint",
        points: [{ flow: 0, head: null }],
      };
    else {
      console.error("Unknown pump type selected");
      return;
    }

    setValidationErrors([]); // Clear errors on type change
    setFitResult(null); // Clear fit result on type change
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
    if (pumpDefinition.type === "multipoint") return;
    const numValue = value === "" ? null : parseFloat(value);
    let updatedPumpDraft = { ...pumpDefinition };
    try {
      if (pumpDefinition.type === "constantPower" && field === "power")
        (updatedPumpDraft as ConstantPowerPump).power = numValue;
      else if (pumpDefinition.type === "onePoint") {
        const p = updatedPumpDraft as OnePointPump;
        if (field === "designPoint.flow") p.designPoint.flow = numValue;
        else if (field === "designPoint.head") p.designPoint.head = numValue;
      } else if (pumpDefinition.type === "threePoint") {
        const p = updatedPumpDraft as ThreePointPump;
        if (field === "shutoffHead") p.shutoffHead = numValue;
        else if (field === "designPoint.flow") p.designPoint.flow = numValue;
        else if (field === "designPoint.head") p.designPoint.head = numValue;
        else if (field === "maxOperatingPoint.flow")
          p.maxOperatingPoint.flow = numValue;
        else if (field === "maxOperatingPoint.head")
          p.maxOperatingPoint.head = numValue;
      }
      handleUpdatePump(updatedPumpDraft);
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
      (point, i) => (i === index ? { ...point, [field]: numValue } : point)
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
    const dataToSave = {
      definition: pumpDefinition,
      fit: fitResult?.success
        ? {
            A: fitResult.A,
            B: fitResult.B,
            C: fitResult.C,
            equation: fitResult.equation,
          }
        : null,
    };
    console.log("Saving Pump Definition:", dataToSave);
    if (pumpDefinition.type === "threePoint" && validationErrors.length > 0) {
      alert(
        `Cannot save: Please fix the validation errors:\n- ${validationErrors.join(
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
      alert(
        `Cannot save: Curve fitting failed.\nError: ${fitResult.errorMessage}`
      );
      return;
    }
    alert("Pump definition saved! (Check console for data)");
    // Example: props.onSave(dataToSave);
  };

  // --- Render Logic ---

  // Calculate points for graph based on selected pump type and fit result
  const graphData = useMemo(() => {
    if (!pumpDefinition) return [];

    let rawPoints: PumpPoint[] = []; // To store raw points for fallback

    if (
      pumpDefinition.type === "onePoint" ||
      pumpDefinition.type === "threePoint"
    ) {
      // Calculate raw points first for fallback
      if (pumpDefinition.type === "onePoint") {
        rawPoints = calculateOnePointCurve(pumpDefinition.designPoint);
      } else {
        // threePoint
        rawPoints = getThreePointRawData(pumpDefinition);
      }

      console.log(rawPoints);

      // Try to use fitted curve points if fit was successful
      if (fitResult?.success && fitResult.curvePoints) {
        // Filter the generated points *here* to check validity before returning
        const filteredFittedPoints: { flow: number; head: number }[] = [];
        fitResult.curvePoints.forEach((p) => {
          if (
            typeof p.q === "number" &&
            typeof p.h === "number" &&
            !isNaN(p.q) &&
            !isNaN(p.h) &&
            isFinite(p.q) &&
            isFinite(p.h)
          ) {
            filteredFittedPoints.push({ flow: p.q, head: p.h });
          }
        });
        // If enough valid points were generated by the fit, use them
        if (filteredFittedPoints.length >= 2) {
          return filteredFittedPoints;
        } else {
          console.warn(
            "Curve fit succeeded but generated insufficient valid points. Falling back to raw data."
          );
        }
      }
      // Fallback to raw points if fit failed OR generated insufficient points
      return rawPoints;
    } else if (pumpDefinition.type === "multipoint") {
      // Use user points for multipoint
      return (pumpDefinition as MultipointPump).points
        .filter(
          (p) =>
            p.flow !== null &&
            p.head !== null &&
            typeof p.flow === "number" &&
            typeof p.head === "number" &&
            !isNaN(p.flow) &&
            !isNaN(p.head) &&
            isFinite(p.flow) &&
            isFinite(p.head)
        )
        .sort((a, b) => a.flow! - b.flow!) as { flow: number; head: number }[];
    }
    return []; // No graph for constant power
  }, [pumpDefinition, fitResult]); // Depend on definition and fit result

  // Render input fields based on type
  const renderInputFields = () => {
    if (!pumpDefinition) return null;

    // Common component to display equation or errors
    const FitResultDisplay = () =>
      (pumpDefinition.type === "onePoint" ||
        pumpDefinition.type === "threePoint") &&
      fitResult ? (
        <div className="mt-3 p-3 border rounded-md bg-gray-50 text-sm">
          <span className="font-semibold text-gray-700">
            Fitted Curve Equation:
          </span>
          {fitResult.success ? (
            <code className="block mt-1 text-gray-800 bg-gray-100 p-2 rounded break-words">
              {fitResult.equation || "N/A"}
            </code>
          ) : (
            <p className="mt-1 text-red-600">
              Fit Error: {fitResult.errorMessage || "Unknown error"}
            </p>
          )}
        </div>
      ) : null;

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
            <FitResultDisplay />
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
                  Input Validation Errors:
                </p>
                <ul className="list-disc list-inside pl-2">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <FitResultDisplay />
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
        const _exhaustiveCheck: never = pumpDefinition;
        console.error("Unhandled pump type:", _exhaustiveCheck);
        return null;
    }
  };

  return (
    <div className="p-6 bg-gray-100 rounded-lg shadow-xl max-w-2xl mx-auto my-8 font-sans">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Pump Definition</h2>
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
          {renderInputFields()}
          {(pumpDefinition.type === "onePoint" ||
            pumpDefinition.type === "threePoint" ||
            pumpDefinition.type === "multipoint") && (
            <div className="flex-grow p-4 border rounded-md bg-white shadow-sm min-h-[350px]">
              <PumpCurveGraph data={graphData} />
            </div>
          )}
        </div>
        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-3">
          <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition duration-150 ease-in-out">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={
              validationErrors.length > 0 ||
              (fitResult !== null && !fitResult.success)
            }
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
