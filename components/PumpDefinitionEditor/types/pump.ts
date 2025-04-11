// Represents a single point on the pump curve
export interface PumpPoint {
  flow: number | null;
  head: number | null;
}

// Represents the different types of pump data
export type PumpType =
  | "constantPower"
  | "onePoint"
  | "threePoint"
  | "multipoint";

// Base interface for all pump definitions
interface PumpDefinitionBase {
  type: PumpType;
}

// Interface for Constant Power pump
export interface ConstantPowerPump extends PumpDefinitionBase {
  type: "constantPower";
  power: number | null; // in kW
}

// Interface for 1-Point pump
export interface OnePointPump extends PumpDefinitionBase {
  type: "onePoint";
  designPoint: PumpPoint;
}

// Interface for 3-Point pump
export interface ThreePointPump extends PumpDefinitionBase {
  type: "threePoint";
  shutoffHead: number | null; // Flow is always 0
  designPoint: PumpPoint;
  maxOperatingPoint: PumpPoint;
}

// Interface for Multipoint pump
export interface MultipointPump extends PumpDefinitionBase {
  type: "multipoint";
  points: PumpPoint[]; // Array of user-defined points
}

// Union type for any pump definition
export type PumpDefinition =
  | ConstantPowerPump
  | OnePointPump
  | ThreePointPump
  | MultipointPump;

// Props for the graph component
export interface PumpCurveGraphProps {
  // Use PumpPoint[] which allows nulls, graph component will filter
  data: PumpPoint[];
}

// Validation Result Type
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Interface for the result of the pump curve fitting function.
 */
export interface PumpCurveFitResult {
  success: boolean;
  A?: number; // Shutoff Head (h at q=0)
  B?: number; // Head loss coefficient (positive for valid curve)
  C?: number; // Head loss exponent
  equation?: string; // Formatted equation string: h = A - B*q^C
  curvePoints?: { q: number; h: number }[]; // Optional generated points along the curve
  errorMessage?: string; // Description of error if success is false
}

// Type for input change handlers in specific input components
export type InputChangeHandler = (
  field: string, // Use specific field names like 'power', 'designPoint.flow', etc.
  value: string
) => void;

export type MultipointChangeHandler = (
  index: number,
  field: keyof PumpPoint, // 'flow' | 'head'
  value: string
) => void;
