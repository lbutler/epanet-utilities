"use client";

import React, { useMemo } from "react";
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
import type { PumpCurveGraphProps } from "./types/pump"; // Adjust path

const PumpCurveGraph: React.FC<PumpCurveGraphProps> = ({
  data,
  multiPoint,
}) => {
  // Filter and sort valid data points for plotting
  const validData = useMemo(() => {
    return data
      .filter(
        (
          p
        ): p is { flow: number; head: number } => // Type guard for clarity
          typeof p.flow === "number" &&
          typeof p.head === "number" &&
          !isNaN(p.flow) &&
          !isNaN(p.head) &&
          isFinite(p.flow) &&
          isFinite(p.head)
      )
      .sort((a, b) => a.flow - b.flow);
  }, [data]);

  if ((validData.length < 3 && !multiPoint) || validData.length < 2) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 rounded-md mt-4">
        <p className="text-center text-gray-500 italic">
          Enter valid data points
          <br />
          to view the pump curve.
        </p>
      </div>
    );
  }

  // Calculate domains safely
  const maxHead =
    validData.length > 0 ? Math.max(0, ...validData.map((p) => p.head)) : 10;

  return (
    <>
      <h3 className="text-lg font-semibold mb-3 text-center text-gray-700">
        Pump Curve Preview
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
              value: "Flow (gpm)", // Consider making units dynamic/props
              position: "insideBottom",
              offset: -15,
            }}
            domain={[0, "auto"]} // Use 'auto' or calculate explicitly: maxFlow * 1.05
            stroke="#6b7280"
            tickFormatter={(tick) => Number(tick).toFixed(0)}
            allowDataOverflow={false}
          />
          <YAxis
            dataKey="head"
            type="number"
            label={{
              value: "Head (ft)", // Consider making units dynamic/props
              angle: -90,
              position: "insideLeft",
              offset: -5, // Adjust offset if needed
            }}
            domain={[
              0,
              (dataMax: number) => Math.max(dataMax * 1.1, maxHead * 1.1, 10),
            ]} // Ensure Y axis accommodates max head + buffer
            stroke="#6b7280"
            tickFormatter={(tick) => Number(tick).toFixed(1)}
            allowDataOverflow={false}
          />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toFixed(2)} ${name === "head" ? "ft" : "gpm"}`, // Add units to tooltip
              name === "head" ? "Head" : "Flow", // Capitalize names
            ]}
            labelFormatter={(label) => `Flow: ${Number(label).toFixed(2)} gpm`}
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.9)", // Slightly more opaque
              borderRadius: "8px",
              borderColor: "#cbd5e1",
              padding: "8px 12px", // Add some padding
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)", // Add subtle shadow
            }}
            cursor={{ stroke: "#9ca3af", strokeDasharray: "3 3" }} // Style cursor line
          />
          <Legend verticalAlign="top" height={36} />
          <Line
            type="monotone" // Smooth curve
            dataKey="head"
            stroke="#3b82f6" // Tailwind blue-500
            strokeWidth={2}
            dot={false} // Hide dots for fitted curve usually
            activeDot={{
              r: 6,
              fill: "#3b82f6",
              stroke: "#fff",
              strokeWidth: 2,
            }} // Style the active dot
            name="Head Curve"
            isAnimationActive={false} // Disable animation for potentially frequent updates
          />
          {/* Optionally add scatter plot for raw input points */}
          {/* <Scatter dataKey="head" fill="#ef4444" name="Input Points" /> */}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
};

export default PumpCurveGraph;
