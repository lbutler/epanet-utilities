import type React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EPANET Model Builder",
  description: "Build an EPANET model from GIS data.",
};

export default function ModelBuildLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
