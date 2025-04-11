import type {
  PumpPoint,
  ThreePointPump,
  ValidationResult,
  PumpCurveFitResult,
} from "../types/pump"; // Adjust path as needed

// --- EPANET Curve Fitting Logic ---
const TINY = 1e-6; // Small number for floating point comparisons
const MAX_ITER = 5; // Maximum iterations for convergence
const CONVERGENCE_TOLERANCE = 0.01; // Tolerance for A convergence

/**
 * Fits pump curve data to the equation hG = A - B*q^C using the iterative
 * method found in the EPANET GUI code.
 *
 * @param nPoints Number of input points (1 or 3).
 * @param qValues Array of flow values (X-coordinates).
 * If nPoints=1, expects [q_design].
 * If nPoints=3, expects [q_low (0), q_design, q_max].
 * @param hValues Array of head values (Y-coordinates).
 * If nPoints=1, expects [h_design].
 * If nPoints=3, expects [h_low (shutoff), h_design, h_max].
 * @param numGeneratedPoints Optional number of points to generate for the curvePoints array. Defaults to 25.
 * @returns PumpCurveFitResult object containing the fit results or an error message.
 */
export function fitPumpCurve(
  nPoints: number,
  qValues: number[],
  hValues: number[],
  numGeneratedPoints: number = 25
): PumpCurveFitResult {
  // ... (Keep the exact implementation of fitPumpCurve function here)
  // Make sure internal variable names don't conflict if copy-pasting directly
  // Ensure it imports necessary types if needed directly, but prefer types from pump.ts
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
    q0 = qValues[0]; // Should be 0 for 3-point input
    h0 = hValues[0]; // Shutoff head
    q1 = qValues[1]; // Design flow
    h1 = hValues[1]; // Design head
    q2 = qValues[2]; // Max op flow
    h2 = hValues[2]; // Max op head
  } else {
    return {
      success: false,
      errorMessage:
        "Invalid number of points specified. Only 1 or 3 points are supported.",
    };
  }

  // --- 2. Validate input points (EPANET's internal check) ---
  if (
    h0 - h1 < -TINY ||
    h1 - h2 < -TINY ||
    q1 - q0 < -TINY || // q0 is 0 here
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
  if (Math.abs(q1 - q0) < TINY && nPoints === 3) {
    // Add check for q1 vs q0
    return {
      success: false,
      errorMessage:
        "Flow points q0 (0) and q1 (Design) are too close together for calculation.",
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

    // Prevent division by zero or log of non-positive
    if (h4 <= TINY || h5 <= TINY || q1 <= TINY) {
      // If h5 is also tiny, maybe it's a flat line?
      if (h5 <= TINY && Math.abs(h1 - h2) < TINY) {
        // Special case: Treat as nearly flat, maybe C=0 or very small B?
        // Epanet source seems to break here, let's try a specific approach
        if (Math.abs(q1 - q2) > TINY) {
          // Check if flows are different
          c = 0.001; // Assign a very small exponent
          try {
            const q1_pow_c = Math.pow(q1, c);
            if (Math.abs(q1_pow_c) > TINY) {
              bInternal = -h4 / q1_pow_c;
              if (bInternal <= TINY) {
                // If B still positive or zero
                a = h0; // Use original shutoff head
                converged = true;
                // console.log("Converged flat line case");
                break; // Exit loop
              }
            }
          } catch {
            /* ignore math errors here */
          }
        }
      }
      // Original break condition
      break;
    }
    const ratio_q = q2 / q1;
    const ratio_h = h5 / h4;

    if (Math.abs(ratio_q - 1.0) < TINY || ratio_q <= 0 || ratio_h <= 0) {
      break;
    }

    try {
      c = Math.log(ratio_h) / Math.log(ratio_q);
    } catch {
      // console.error("Math error calculating C:", e);
      break; // Exit loop on math error (e.g., log of zero/negative)
    }

    if (c <= 0.0 || c > 20.0) {
      break;
    }

    let q1_pow_c: number;
    try {
      q1_pow_c = Math.pow(q1, c);
    } catch {
      // console.error("Math error calculating q1^c:", e);
      break; // Exit loop on math error (e.g., overflow)
    }

    if (Math.abs(q1_pow_c) < TINY) {
      // If q1^c is tiny, but h4 is not, something is wrong
      if (Math.abs(h4) > TINY) {
        break;
      } else {
        // If both are tiny, maybe B is effectively zero?
        bInternal = 0;
        // Proceed to check convergence based on 'a'
      }
    } else {
      bInternal = -h4 / q1_pow_c;
    }

    if (bInternal > TINY) {
      // Check if B would be negative
      // console.warn("Iteration resulted in potentially negative B. Breaking.")
      break;
    }

    let a1: number;
    // Use the first point (q0, h0) which is shutoff for 3-point
    if (q0 < TINY) {
      a1 = h0; // For shutoff point, A should ideally match h0
    } else {
      // This branch shouldn't be hit for 3-point as q0=0
      try {
        a1 = h0 - bInternal * Math.pow(q0, c);
      } catch {
        // console.error("Math error calculating a1:", e);
        break; // Exit loop on math error
      }
    }

    // Use the refined 'a' based on the known h0 at q0=0
    a1 = h0 - bInternal * Math.pow(q0, c); // Recalculate a1 even if q0=0 (term becomes 0)

    if (Math.abs(a1 - a) < CONVERGENCE_TOLERANCE * a) {
      // Relative tolerance
      a = a1;
      converged = true;
      break;
    }
    a = a1;
  } // End of iteration loop

  // --- 5. Prepare and Return Result ---
  if (converged) {
    const B = -bInternal;
    if (B < -TINY) {
      // Allow B to be very slightly negative due to float math
      return {
        success: false,
        errorMessage: `Fit resulted in a negative B coefficient (${B.toExponential(
          3
        )}), indicating an invalid curve shape. Check input points.`,
      };
    }
    // Ensure C is within reasonable bounds post-convergence
    if (c <= 0 || c > 20) {
      return {
        success: false,
        errorMessage: `Fit converged but exponent C (${c.toFixed(
          4
        )}) is outside valid range (0 < C <= 20).`,
      };
    }

    const finalB = Math.max(0, B); // Clamp B to non-negative

    const equation = `Head = ${a.toFixed(4)} - ${finalB.toExponential(
      4
    )} * (Flow)^${c.toFixed(4)}`;
    const curvePoints: { q: number; h: number }[] = [];
    let qMaxTheoretical = 0;

    // Calculate theoretical flow where head becomes zero
    if (finalB > TINY && c !== 0 && a > 0) {
      try {
        qMaxTheoretical = Math.pow(a / finalB, 1.0 / c);
      } catch {
        // console.warn("Could not calculate theoretical max flow, using max input flow.", e);
        qMaxTheoretical = q2; // Fallback to max input flow
      }
    } else if (a <= TINY) {
      // If shutoff head is near zero, max flow is effectively zero
      qMaxTheoretical = 0;
    } else {
      // If B is near zero (flat curve), use the max input flow provided
      qMaxTheoretical = q2;
    }

    const plotQmax = Math.max(qMaxTheoretical, q2, q1);

    if (plotQmax <= TINY) {
      // If max flow is zero, only plot the shutoff point
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
          h_calc = a; // Use A directly for flow = 0
        } else {
          try {
            h_calc = a - finalB * Math.pow(q, c);
          } catch {
            // console.warn(`Math error calculating head at q=${q}`, e);
            h_calc = -Infinity; // Indicate calculation failure
          }
        }
        const finalH = Math.max(0, h_calc); // Ensure head is non-negative

        if (isFinite(finalH) && isFinite(q)) {
          // Prevent duplicate points if dq is very small or qMaxTheoretical is close to a step
          if (
            curvePoints.length === 0 ||
            Math.abs(curvePoints[curvePoints.length - 1].q - q) > TINY
          ) {
            curvePoints.push({ q: q, h: finalH });
          } else if (
            Math.abs(curvePoints[curvePoints.length - 1].h - finalH) > TINY
          ) {
            // If flow is same but head differs, update head? Or keep first? Let's keep first for stability.
            // curvePoints[curvePoints.length - 1].h = finalH;
          }
        } else {
          // console.warn(`Skipping point generation for q=${q} due to non-finite head calculation.`);
        }
      }
      // Ensure the theoretical max flow point (where h=0) is added if valid and not already covered
      const lastPoint = curvePoints[curvePoints.length - 1];
      if (
        qMaxTheoretical > TINY &&
        isFinite(qMaxTheoretical) &&
        (!lastPoint || Math.abs(lastPoint.q - qMaxTheoretical) > TINY) &&
        lastPoint.h > TINY // Only add if the last calculated point wasn't already at zero head
      ) {
        curvePoints.push({ q: qMaxTheoretical, h: 0 });
      }
    }

    // Final check if enough points were generated for a line
    if (curvePoints.length < 2) {
      // Even if converged, point generation failed to produce a usable line.
      return {
        success: false,
        errorMessage:
          "Fit converged but failed to generate sufficient curve points for plotting.",
      };
    }

    return {
      success: true,
      A: a,
      B: finalB,
      C: c,
      equation: equation,
      curvePoints: curvePoints,
    };
  } else {
    // Provide more specific error messages based on potential break conditions
    let errorMessage =
      "Fitting algorithm did not converge within maximum iterations.";
    if (c <= 0.0) errorMessage = "Fit failed: Exponent C became non-positive.";
    else if (c > 20.0)
      errorMessage = "Fit failed: Exponent C became too large (> 20).";
    else if (bInternal > TINY)
      errorMessage =
        "Fit failed: Coefficient B became negative (invalid curve shape).";
    else if (qValues.length > 1 && Math.abs(qValues[2] - qValues[1]) < TINY)
      errorMessage = "Flow points q1 and q2 are too close.";
    // Add other checks based on where the loop might have broken early

    return { success: false, errorMessage: errorMessage };
  }
}

// --- Utility Functions ---

/**
 * Calculates the shutoff and max operating points for a 1-point curve based on EPANET logic.
 * Returns an array of 3 points: [shutoff, design, max_operating].
 * Returns empty array if input is invalid.
 */
export const calculateOnePointCurvePoints = (
  designPoint: PumpPoint
): PumpPoint[] => {
  const designFlow = designPoint.flow;
  const designHead = designPoint.head;

  // Ensure valid numeric inputs
  if (
    designFlow === null ||
    designHead === null ||
    typeof designFlow !== "number" ||
    typeof designHead !== "number" ||
    isNaN(designFlow) ||
    isNaN(designHead) ||
    designFlow <= 0 ||
    designHead <= 0
  ) {
    // Return placeholder points or empty array to signify invalid input for calculation
    return [
      { flow: 0, head: null }, // Shutoff (calculated)
      { flow: designFlow, head: designHead }, // Design (input)
      { flow: null, head: 0 }, // Max Operating (calculated)
    ];
  }

  const shutoffHead = designHead * 1.33334; // Using 1.33334 for closer match to EPANET's 4/3
  const maxOperatingFlow = designFlow * 2;

  return [
    { flow: 0, head: shutoffHead },
    { flow: designFlow, head: designHead },
    { flow: maxOperatingFlow, head: 0 },
  ];
};

/**
 * Prepares raw data points from a 3-point definition.
 * Filters out points with null values but keeps them in order.
 */
export const getThreePointRawData = (pump: ThreePointPump): PumpPoint[] => {
  // Order is important: Shutoff, Design, Max Operating
  const points = [
    { flow: 0, head: pump.shutoffHead },
    { flow: pump.designPoint.flow, head: pump.designPoint.head },
    { flow: pump.maxOperatingPoint.flow, head: pump.maxOperatingPoint.head },
  ];
  // Return the array including potential nulls for display/validation purposes
  // The graph component will handle filtering numeric points for plotting
  return points;
};

/**
 * Validates the input values for a 3-Point Curve definition.
 */
export const validateThreePointCurve = (
  pump: ThreePointPump
): ValidationResult => {
  const errors: string[] = [];
  const { shutoffHead, designPoint, maxOperatingPoint } = pump;

  const pointsToCheck = [
    { value: shutoffHead, name: "Shutoff Head" },
    { value: designPoint.flow, name: "Design Flow" },
    { value: designPoint.head, name: "Design Head" },
    { value: maxOperatingPoint.flow, name: "Max Operating Flow" },
    { value: maxOperatingPoint.head, name: "Max Operating Head" },
  ];

  let allNumericAndPositive = true; // Check for positivity as well

  pointsToCheck.forEach((p) => {
    if (p.value === null || typeof p.value !== "number" || isNaN(p.value)) {
      errors.push(`${p.name} must be a valid number.`);
      allNumericAndPositive = false;
    } else if (p.value < 0) {
      // Allow Max Operating Head to be 0, but not negative
      if (!(p.name === "Max Operating Head" && p.value === 0)) {
        errors.push(`${p.name} must be non-negative.`);
        allNumericAndPositive = false;
      }
    }
  });

  // Check Design Flow > 0
  if (typeof designPoint.flow === "number" && designPoint.flow <= 0) {
    errors.push("Design Flow must be positive.");
    allNumericAndPositive = false;
  }

  // Perform relational checks only if all values are valid numbers and positive (where applicable)
  if (allNumericAndPositive) {
    // Type assertions are safe here because we checked for null/non-number/negativity
    const sh = shutoffHead as number;
    const df = designPoint.flow as number;
    const dh = designPoint.head as number;
    const mf = maxOperatingPoint.flow as number;
    const mh = maxOperatingPoint.head as number;

    if (mf <= df) {
      errors.push("Max Operating Flow must be greater than Design Flow.");
    }
    if (sh <= dh) {
      errors.push("Shutoff Head must be greater than Design Head.");
    }
    if (dh < mh) {
      // Allow dh == mh (flat curve section is possible)
      errors.push(
        "Design Head must be greater than or equal to Max Operating Head."
      );
    }
    if (mh < 0) {
      // Explicitly check Max Operating Head >= 0
      errors.push("Max Operating Head cannot be negative.");
    }
  }

  return { isValid: errors.length === 0, errors };
};
