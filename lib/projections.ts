import type { Projection } from "./types"

// Move projections to a TypeScript file for better type safety and reliability
export const projections: Projection[] = [
  { id: "epsg:4326", name: "WGS 84", code: "EPSG:4326" },
  { id: "epsg:3857", name: "Web Mercator", code: "EPSG:3857" },
  { id: "epsg:4269", name: "NAD83", code: "EPSG:4269" },
  { id: "epsg:26910", name: "NAD83 / UTM zone 10N", code: "EPSG:26910" },
  { id: "epsg:26911", name: "NAD83 / UTM zone 11N", code: "EPSG:26911" },
  { id: "epsg:26912", name: "NAD83 / UTM zone 12N", code: "EPSG:26912" },
]

export async function getProjections(): Promise<Projection[]> {
  // In a real application, this would fetch from an API
  // For now, we'll return the static data with a simulated delay
  await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate network delay
  return projections
}

