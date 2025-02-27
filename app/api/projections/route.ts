import { NextResponse } from "next/server"
import type { Projection } from "@/lib/types"

// This would typically come from a database
const allProjections: Projection[] = [
  { id: "epsg:4326", name: "WGS 84", code: "EPSG:4326", proj4: "+proj=longlat +datum=WGS84 +no_defs" },
  {
    id: "epsg:3857",
    name: "Web Mercator",
    code: "EPSG:3857",
    proj4:
      "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs",
  },
  // ... thousands more projections
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.toLowerCase() || ""
  const page = Number.parseInt(searchParams.get("page") || "1")
  const limit = 10

  // Filter projections based on search query
  const filtered = !query
    ? allProjections
    : allProjections.filter(
        (proj) =>
          proj.name.toLowerCase().includes(query) ||
          proj.code.toLowerCase().includes(query) ||
          proj.proj4.toLowerCase().includes(query),
      )

  // Paginate results
  const start = (page - 1) * limit
  const end = start + limit
  const results = filtered.slice(start, end)
  const hasMore = filtered.length > end

  return NextResponse.json({
    items: results,
    hasMore,
    total: filtered.length,
  })
}

