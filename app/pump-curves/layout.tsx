import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EPANET Pump Curves",
  description: "Create pump curves for EPANET using the pump curve generator",
};

export default function PumpCurveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
