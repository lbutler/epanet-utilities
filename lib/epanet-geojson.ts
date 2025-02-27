import {
  FeatureCollection,
  Feature,
  Geometry,
  Point,
  LineString,
} from "geojson";

/******************************************************
 * INTERFACES & TYPES
 ******************************************************/

/** A structured parse error for better debugging */
export interface ParseError {
  line: number; // Which line in the INP file caused the error
  section: string; // The [SECTION] we believe we're in
  message: string; // Explanation of what went wrong
}

/** This is the main return from `toGeoJson`. */
export interface ToGeoJsonResult {
  geojson: EpanetGeoJSON; // The best attempt at the model so far
  errors: ParseError[]; // Any parse errors
}

/** The specialized FeatureCollection we want to return */
export interface EpanetGeoJSON extends FeatureCollection {
  /** The union of all EPANET features that we parsed */
  features: EpanetFeature[];
}

/** Any EPANET Feature can be a Node or a Link */
type EpanetFeature = NodeFeature | LinkFeature;

/** Nodes vs. Links */
type NodeFeature = Junction | Tank | Reservoir;
type LinkFeature = Pipe | Valve | Pump;

/** Base Node property shape */
interface NodeProperties {
  type: "Node";
  category: "Junction" | "Tank" | "Reservior";
  id: string;
}

/** Base Link property shape */
interface LinkProperties {
  type: "Link";
  category: "Pipe" | "Valve" | "Pump";
  id: string;
  usNodeId: string;
  dsNodeId: string;
}

/****************************************
 * NODE Feature Types (Junction, Tank, Reservoir)
 ****************************************/
export interface JunctionProperties extends NodeProperties {
  category: "Junction";
  elevation: number;
  demand?: number;
  pattern?: string;
}
export interface Junction extends Feature<Point, JunctionProperties> {
  properties: JunctionProperties;
}

export interface TankProperties extends NodeProperties {
  category: "Tank";
  elevation: number;
  initLevel: number;
  minLevel: number;
  maxLevel: number;
  diameter: number;
  minVolume: number;
  volCurve: string;
  overflow?: boolean;
}
export interface Tank extends Feature<Point, TankProperties> {
  properties: TankProperties;
}

export interface ReservoirProperties extends NodeProperties {
  category: "Reservior";
  head: number;
  pattern?: string;
}
export interface Reservoir extends Feature<Point, ReservoirProperties> {
  properties: ReservoirProperties;
}

/****************************************
 * LINK Feature Types (Pipe, Valve, Pump)
 ****************************************/
type PipeStatus = "Open" | "Closed" | "CV";

export interface PipeProperties extends LinkProperties {
  category: "Pipe";
  length: number;
  diameter: number;
  roughness: number;
  minorLoss: number;
  status?: PipeStatus;
}
export interface Pipe extends Feature<LineString, PipeProperties> {
  properties: PipeProperties;
}

type ValveType = "PRV" | "PSV" | "PBV" | "FCV" | "TCV" | "GPV";

export interface ValveProperties extends LinkProperties {
  category: "Valve";
  diameter: number;
  valveType: ValveType;
  setting: number;
  minorLoss: number;
}
export interface Valve extends Feature<LineString, ValveProperties> {
  properties: ValveProperties;
}

type PumpMode = "Power" | "Head";

interface BasePumpProperties extends LinkProperties {
  category: "Pump";
  mode: PumpMode;
  speed?: number;
  pattern?: string;
}

/** Pump can be in "Power" mode or "Head" mode. */
export interface PowerPumpProperties extends BasePumpProperties {
  mode: "Power";
  power: number;
}
export interface HeadPumpProperties extends BasePumpProperties {
  mode: "Head";
  head: string;
}
export type PumpProperties = PowerPumpProperties | HeadPumpProperties;

export interface Pump extends Feature<LineString, PumpProperties> {
  properties: PumpProperties;
}

/******************************************************
 * Internal parsing data structures
 ******************************************************/
interface NodeLookup {
  [id: string]: NodeFeature;
}
interface LinkLookup {
  [id: string]: LinkFeature;
}

/** Internal ephemeral data store during parsing */
interface EpanetData {
  currentFunction: string; // e.g. "[JUNCTIONS]" or "[PIPES]" etc.
  nodeIndex: number; // incremental numeric ID for node features
  linkIndex: number; // incremental numeric ID for link features
  errors: ParseError[]; // accumulate errors
  nodes: NodeLookup; // all Node features, keyed by their string ID
  links: LinkLookup; // all Link features, keyed by their string ID
}

/******************************************************
 * Main Exported Parsing Function
 ******************************************************/

export function toGeoJson(inpFile: string): ToGeoJsonResult {
  const epanetData: EpanetData = {
    currentFunction: "",
    nodeIndex: 0,
    linkIndex: 0,
    errors: [],
    nodes: {},
    links: {},
  };

  // Split input lines
  const lines = inpFile.split("\n");

  // Process each line
  const finalData = lines.reduce((acc, line, index) => {
    return parseLine(acc, line, index + 1); // +1 for human-friendly line numbering
  }, epanetData);

  // Build final geometries for links:
  // place upstream node coordinate, optional bends (VERTICES), then downstream node coordinate
  const linkFeatures = Object.keys(finalData.links).map((linkId) => {
    const link = finalData.links[linkId];
    const { usNodeId, dsNodeId } = link.properties;

    const usNode = finalData.nodes[usNodeId];
    const dsNode = finalData.nodes[dsNodeId];

    if (!usNode || !dsNode) {
      addError(
        finalData,
        0,
        `Link "${linkId}" references missing node(s): [${usNodeId}, ${dsNodeId}]`
      );
      return link; // keep as-is (with partial geometry) but note the error
    }

    const usCoords = usNode.geometry.coordinates;
    const dsCoords = dsNode.geometry.coordinates;
    // The link might have some "bend" coordinates from [VERTICES]
    const midCoords = link.geometry.coordinates;
    const finalCoords = [usCoords, ...midCoords, dsCoords];

    return {
      ...link,
      geometry: {
        ...link.geometry,
        coordinates: finalCoords,
      },
    };
  });

  // Combine node features and link features
  const nodeFeatures = Object.values(finalData.nodes);
  const features = [...nodeFeatures, ...linkFeatures];

  // Final output
  const geojson: EpanetGeoJSON = {
    type: "FeatureCollection",
    features: features,
  };

  return {
    geojson,
    errors: finalData.errors,
  };
}

/******************************************************
 * parseLine: Decide which parsing function to call
 ******************************************************/

function parseLine(
  data: EpanetData,
  rawLine: string,
  lineNumber: number
): EpanetData {
  // Remove comments: anything after ';'
  const commentIndex = rawLine.indexOf(";");
  const lineContent = (
    commentIndex === -1 ? rawLine : rawLine.slice(0, commentIndex)
  )
    // compress multiple spaces/tabs to one
    .replace(/\s+/g, " ")
    // trim left/right
    .trim();

  // Skip blank lines (or lines that were all comment)
  if (!lineContent) {
    return data;
  }

  // If a line starts with '[', it's a new section
  if (lineContent.startsWith("[") && lineContent.endsWith("]")) {
    data.currentFunction = lineContent; // e.g. "[JUNCTIONS]"
    return data;
  }

  // Switch by current [SECTION]
  switch (data.currentFunction.toUpperCase()) {
    case "[JUNCTIONS]":
      return parseJunction(data, lineContent, lineNumber);
    case "[RESERVOIRS]":
      return parseReservoir(data, lineContent, lineNumber);
    case "[TANKS]":
      return parseTank(data, lineContent, lineNumber);
    case "[PIPES]":
      return parsePipe(data, lineContent, lineNumber);
    case "[VALVES]":
      return parseValve(data, lineContent, lineNumber);
    case "[PUMPS]":
      return parsePump(data, lineContent, lineNumber);
    case "[COORDINATES]":
      return parseCoordinates(data, lineContent, lineNumber);
    case "[VERTICES]":
      return parseVertices(data, lineContent, lineNumber);

    default:
      // We don't know this section; record an error but don't stop
      addError(
        data,
        lineNumber,
        `Unrecognized section: "${data.currentFunction}". Line: "${lineContent}"`
      );
      return data;
  }
}

/******************************************************
 * HELPER: Add an error to epanetData
 ******************************************************/
function addError(data: EpanetData, line: number, message: string) {
  data.errors.push({
    line,
    section: data.currentFunction,
    message,
  });
}

/******************************************************
 * PARSER FUNCTIONS
 ******************************************************/

/** [JUNCTIONS]
 * Format (commonly):
 *   ID  Elevation  [Demand]  [Pattern]
 */
function parseJunction(
  data: EpanetData,
  line: string,
  lineNumber: number
): EpanetData {
  const tokens = line.split(" ");
  if (tokens.length < 2) {
    addError(
      data,
      lineNumber,
      `Junction requires at least 2 columns: ID, Elevation. Got: "${line}"`
    );
    return data;
  }
  const [id, elevStr, demandStr, patternStr] = tokens;
  const elevation = parseFloat(elevStr);
  if (isNaN(elevation)) {
    addError(
      data,
      lineNumber,
      `Could not parse JUNCTION elevation as float: "${elevStr}"`
    );
  }

  let demand: number | undefined;
  if (demandStr !== undefined) {
    const val = parseFloat(demandStr);
    if (!isNaN(val)) {
      demand = val;
    } else {
      addError(
        data,
        lineNumber,
        `Could not parse JUNCTION demand as float: "${demandStr}"`
      );
    }
  }

  const junction: Junction = {
    type: "Feature",
    id: data.nodeIndex,
    geometry: {
      type: "Point",
      coordinates: [0, 0], // will be updated by [COORDINATES]
    },
    properties: {
      type: "Node",
      category: "Junction",
      id,
      elevation,
      demand,
      pattern: patternStr,
    },
  };

  data.nodes[id] = junction;
  data.nodeIndex++;
  return data;
}

/** [RESERVOIRS]
 * Format (commonly):
 *   ID  Head  [Pattern]
 */
function parseReservoir(
  data: EpanetData,
  line: string,
  lineNumber: number
): EpanetData {
  const tokens = line.split(" ");
  if (tokens.length < 2) {
    addError(data, lineNumber, `Reservoir requires ID, Head. Got: "${line}"`);
    return data;
  }
  const [id, headStr, patternStr] = tokens;
  const head = parseFloat(headStr);
  if (isNaN(head)) {
    addError(
      data,
      lineNumber,
      `Could not parse RESERVOIR head as float: "${headStr}"`
    );
  }

  const reservoir: Reservoir = {
    type: "Feature",
    id: data.nodeIndex,
    geometry: {
      type: "Point",
      coordinates: [0, 0],
    },
    properties: {
      type: "Node",
      category: "Reservior",
      id,
      head,
      pattern: patternStr,
    },
  };

  data.nodes[id] = reservoir;
  data.nodeIndex++;
  return data;
}

/** [TANKS]
 * Format (commonly):
 *  ID  Elevation  InitLevel  MinLevel  MaxLevel  Diameter  MinVolume  VolCurve  [Overflow?]
 */
function parseTank(
  data: EpanetData,
  line: string,
  lineNumber: number
): EpanetData {
  const tokens = line.split(" ");
  if (tokens.length < 7) {
    addError(
      data,
      lineNumber,
      `Tank requires at least 7 columns. Got: "${line}"`
    );
    return data;
  }

  const [
    id,
    elevStr,
    initStr,
    minStr,
    maxStr,
    diaStr,
    minVolStr,
    volCurve,
    overflowStr,
  ] = tokens;

  function parseNumOrWarn(s: string, desc: string): number {
    const val = parseFloat(s);
    if (isNaN(val)) {
      addError(data, lineNumber, `Could not parse ${desc} for TANK: "${s}"`);
      return 0;
    }
    return val;
  }

  const elevation = parseNumOrWarn(elevStr, "elevation");
  const initLevel = parseNumOrWarn(initStr, "initLevel");
  const minLevel = parseNumOrWarn(minStr, "minLevel");
  const maxLevel = parseNumOrWarn(maxStr, "maxLevel");
  const diameter = parseNumOrWarn(diaStr, "diameter");
  const minVolume = parseNumOrWarn(minVolStr, "minVolume");

  const tank: Tank = {
    type: "Feature",
    id: data.nodeIndex,
    geometry: {
      type: "Point",
      coordinates: [0, 0],
    },
    properties: {
      type: "Node",
      category: "Tank",
      id,
      elevation,
      initLevel,
      minLevel,
      maxLevel,
      diameter,
      minVolume,
      volCurve: volCurve || "",
      overflow: overflowStr?.toLowerCase() === "true",
    },
  };

  data.nodes[id] = tank;
  data.nodeIndex++;
  return data;
}

/** [PIPES]
 * Format (commonly):
 *  ID  UsNode  DsNode  Length  Diameter  Roughness  MinorLoss  [Status]
 */
function parsePipe(
  data: EpanetData,
  line: string,
  lineNumber: number
): EpanetData {
  const tokens = line.split(" ");
  if (tokens.length < 6) {
    addError(
      data,
      lineNumber,
      `Pipe requires at least 6 columns. Got: "${line}"`
    );
    return data;
  }
  const [
    id,
    usNodeId,
    dsNodeId,
    lengthStr,
    diamStr,
    roughStr,
    minorStr,
    statusStr,
  ] = tokens;

  const lengthVal = parseFloat(lengthStr);
  const diameterVal = parseFloat(diamStr);
  const roughVal = parseFloat(roughStr);
  const minorVal = parseFloat(minorStr);

  let status: PipeStatus | undefined;
  if (statusStr) {
    const lc = statusStr.toLowerCase();
    if (lc === "open") status = "Open";
    else if (lc === "closed") status = "Closed";
    else if (lc === "cv") status = "CV";
  }

  const pipe: Pipe = {
    type: "Feature",
    id: data.linkIndex,
    geometry: {
      type: "LineString",
      coordinates: [], // will update after reading [VERTICES]
    },
    properties: {
      type: "Link",
      category: "Pipe",
      id,
      usNodeId,
      dsNodeId,
      length: isNaN(lengthVal) ? 0 : lengthVal,
      diameter: isNaN(diameterVal) ? 0 : diameterVal,
      roughness: isNaN(roughVal) ? 0 : roughVal,
      minorLoss: isNaN(minorVal) ? 0 : minorVal,
      status,
    },
  };

  data.links[id] = pipe;
  data.linkIndex++;
  return data;
}

/** [VALVES]
 * Format (commonly simplified):
 *  ID  UsNode  DsNode  (others)
 */
function parseValve(
  data: EpanetData,
  line: string,
  lineNumber: number
): EpanetData {
  const tokens = line.split(" ");
  if (tokens.length < 3) {
    addError(
      data,
      lineNumber,
      `Valve requires at least 3 columns. Got: "${line}"`
    );
    return data;
  }
  const [id, usNodeId, dsNodeId] = tokens;

  // Simplified defaults
  const valve: Valve = {
    type: "Feature",
    id: data.linkIndex,
    geometry: {
      type: "LineString",
      coordinates: [],
    },
    properties: {
      type: "Link",
      category: "Valve",
      id,
      usNodeId,
      dsNodeId,
      diameter: 100,
      valveType: "TCV",
      setting: 100,
      minorLoss: 0,
    },
  };

  data.links[id] = valve;
  data.linkIndex++;
  return data;
}

/** [PUMPS]
 * Format (commonly simplified):
 *  ID  UsNode  DsNode  (others)
 */
function parsePump(
  data: EpanetData,
  line: string,
  lineNumber: number
): EpanetData {
  const tokens = line.split(" ");
  if (tokens.length < 3) {
    addError(
      data,
      lineNumber,
      `Pump requires at least 3 columns. Got: "${line}"`
    );
    return data;
  }
  const [id, usNodeId, dsNodeId] = tokens;

  // Example default: "Power" pump with power=2, speed=1, pattern="dummy"
  const pump: Pump = {
    type: "Feature",
    id: data.linkIndex,
    geometry: {
      type: "LineString",
      coordinates: [],
    },
    properties: {
      type: "Link",
      category: "Pump",
      id,
      usNodeId,
      dsNodeId,
      mode: "Power",
      power: 2,
      speed: 1,
      pattern: "dummy",
    } as PowerPumpProperties,
  };

  data.links[id] = pump;
  data.linkIndex++;
  return data;
}

/** [COORDINATES]
 * Format:
 *  NodeID  Xcoord  Ycoord
 */
function parseCoordinates(
  data: EpanetData,
  line: string,
  lineNumber: number
): EpanetData {
  const tokens = line.split(" ");
  if (tokens.length < 3) {
    addError(
      data,
      lineNumber,
      `COORDINATES requires NodeID, X, Y. Got: "${line}"`
    );
    return data;
  }
  const [nodeId, xStr, yStr] = tokens;
  const node = data.nodes[nodeId];
  if (!node) {
    addError(
      data,
      lineNumber,
      `COORDINATES references unknown node "${nodeId}".`
    );
    return data;
  }

  const x = parseFloat(xStr);
  const y = parseFloat(yStr);
  if (isNaN(x) || isNaN(y)) {
    addError(
      data,
      lineNumber,
      `COORDINATES invalid X/Y: "${xStr}", "${yStr}".`
    );
    return data;
  }
  node.geometry.coordinates = [x, y];
  return data;
}

/** [VERTICES]
 * Format:
 *  LinkID  Xcoord  Ycoord
 */
function parseVertices(
  data: EpanetData,
  line: string,
  lineNumber: number
): EpanetData {
  const tokens = line.split(" ");
  if (tokens.length < 3) {
    addError(
      data,
      lineNumber,
      `VERTICES requires LinkID, X, Y. Got: "${line}"`
    );
    return data;
  }
  const [linkId, xStr, yStr] = tokens;
  const link = data.links[linkId];
  if (!link) {
    addError(data, lineNumber, `VERTICES references unknown link "${linkId}".`);
    return data;
  }

  const x = parseFloat(xStr);
  const y = parseFloat(yStr);
  if (isNaN(x) || isNaN(y)) {
    addError(data, lineNumber, `VERTICES invalid X/Y: "${xStr}", "${yStr}".`);
    return data;
  }

  link.geometry.coordinates.push([x, y]);
  return data;
}
