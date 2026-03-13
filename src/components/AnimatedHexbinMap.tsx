import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { hexbin as d3Hexbin } from "d3-hexbin";
import { parsePointWKT, toNumber } from "../lib/parse";
import BevPhevChart, { type BevPhevRow } from "./BevPhevChart";
import UrbanRuralChart, { type UrbanRuralRow } from "./UrbanRuralChart";
import TutorialOverlay, { type TutorialStepDef } from "./TutorialOverlay";

type EvRow = {
  ["Model Year"]: number;
  ["Electric Vehicle Type"]: string;
  ["Vehicle Location"]: string;
  County: string;
};

type StationRow = {
  Latitude: number;
  Longitude: number;
  ["EV Level2 EVSE Num"]: number;
  ["EV DC Fast Count"]: number;
  openYear: number | null;
};

type TooltipState = {
  x: number;
  y: number;
  count: number;
} | null;

type Props = {
  width?: number;
  height?: number;
};

const YEAR_MIN = 2015;
const YEAR_MAX = 2024;

type Checkpoint = {
  year: number;
  label: string;
  observation: string;
  evidence: string;
  policyInsight: string;
};

const CHECKPOINTS: Checkpoint[] = [
  {
    year: 2017,
    label: "2015–2017: Early Adopters",
    observation:
      "EVs appear almost exclusively in the Seattle metro. Look at the map — how many hexagons are lit up east of the Cascades?",
    evidence:
      "BEV already dominates — but total volume is tiny. The Urban bar dwarfs Suburban and Rural. This is a luxury product in a single city.",
    policyInsight:
      "If nothing changes, EVs become a tool that widens inequality rather than closes it. What would it take to change this trajectory?",
  },
  {
    year: 2019,
    label: "2018–2019: The Model 3 Effect",
    observation:
      "Watch the hexbin spread outward from Seattle. One product — the $35k Model 3 — triggered suburban adoption that policy alone hadn’t achieved.",
    evidence:
      "BEV share climbs sharply. Charging stations follow demand into new corridors. Price was the barrier, not interest.",
    policyInsight:
      "Affordability unlocks scale faster than incentives alone. Who else is still priced out, and what would reach them?",
  },
  {
    year: 2021,
    label: "2020–2021: COVID Dip + Policy Rebound",
    observation:
      "Growth briefly stalls in 2020, then surges. Toggle charging stations — do they lead the recovery, or follow it?",
    evidence:
      "WA expanded EV rebates during the downturn. BEV share kept rising even as total sales dipped. Policy held the floor.",
    policyInsight:
      "Incentives stabilize existing demand. But stabilizing is different from expanding into new markets.",
  },
  {
    year: 2024,
    label: "2022–2024: Statewide Wave — The Gap Persists",
    observation:
      "Eastern WA finally shows activity. Compare the color depth: Seattle is deep teal, Eastern WA barely tinted. Now toggle charging stations off — where are the gaps?",
    evidence:
      "BEV share exceeds 70%. Yet the Urban–Rural density gap in the bar chart is wider than ever.",
    policyInsight:
      "Adoption spreads, but the divide widens in relative terms. Rural buyers face range anxiety and charging deserts. This is the actionable policy gap.",
  },
];

const CHECKPOINT_COLORS = ["#1d4ed8", "#d97706", "#059669", "#7c3aed"];

const COUNTY_CLASS: Record<string, "Urban" | "Suburban" | "Rural"> = {
  King: "Urban", Pierce: "Urban", Snohomish: "Urban", Spokane: "Urban", Clark: "Urban",
  Kitsap: "Suburban", Thurston: "Suburban", Whatcom: "Suburban", Skagit: "Suburban",
  Benton: "Suburban", Yakima: "Suburban", Cowlitz: "Suburban", Grant: "Suburban", Franklin: "Suburban",
  Adams: "Rural", Asotin: "Rural", Chelan: "Rural", Clallam: "Rural", Columbia: "Rural",
  Douglas: "Rural", Ferry: "Rural", Garfield: "Rural", "Grays Harbor": "Rural", Island: "Rural",
  Jefferson: "Rural", Klickitat: "Rural", Lewis: "Rural", Lincoln: "Rural", Mason: "Rural",
  Okanogan: "Rural", Pacific: "Rural", "Pend Oreille": "Rural", "San Juan": "Rural",
  Skamania: "Rural", Stevens: "Rural", Wahkiakum: "Rural", "Walla Walla": "Rural", Whitman: "Rural",
};

const COUNTY_POP: Record<string, number> = {
  King: 2269675, Pierce: 921130, Snohomish: 827957, Spokane: 522798, Clark: 503320,
  Kitsap: 271473, Thurston: 290536, Whatcom: 229247, Skagit: 129205, Benton: 204390,
  Yakima: 250873, Cowlitz: 110593, Grant: 96611, Franklin: 95222,
  Adams: 19983, Asotin: 22582, Chelan: 77200, Clallam: 77331, Columbia: 4078,
  Douglas: 43429, Ferry: 7627, Garfield: 2225, "Grays Harbor": 75061, Island: 85141,
  Jefferson: 32221, Klickitat: 22425, Lewis: 80925, Lincoln: 10939, Mason: 66768,
  Okanogan: 42243, Pacific: 22471, "Pend Oreille": 13880, "San Juan": 17582,
  Skamania: 12083, Stevens: 46463, Wahkiakum: 4488, "Walla Walla": 62444, Whitman: 50248,
};

function parseYear(v: any): number | null {
  if (!v) return null;
  const dt = new Date(String(v));
  const y = dt.getFullYear();
  return Number.isFinite(y) ? y : null;
}

const btnBase: React.CSSProperties = {
  padding: "7px 16px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  cursor: "pointer",
  fontSize: 13,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
};

export default function AnimatedHexbinMap({ width = 1080, height = 580 }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [waGeo, setWaGeo] = useState<any | null>(null);
  const [waCounties, setWaCounties] = useState<any | null>(null);
  const [evRows, setEvRows] = useState<EvRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);

  const [year, setYear] = useState<number>(CHECKPOINTS[0].year);
  const [showStations, setShowStations] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState<number>(0);
  const [visitedCheckpoints, setVisitedCheckpoints] = useState<Set<number>>(new Set([0]));
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [inGuidedMode, setInGuidedMode] = useState(true);
  const [nextReminder, setNextReminder] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

  // Tutorial target refs
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const checkpointPanelRef = useRef<HTMLDivElement | null>(null);
  const skipBtnRef = useRef<HTMLButtonElement | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const tutorialSteps: TutorialStepDef[] = [
    {
      refKey: "nextBtn",
      title: "Advance the story",
      body: "Click \"Next Checkpoint →\" to move through 4 key moments in Washington's EV history. Each step highlights a different policy insight.",
      arrowSide: "top",
    },
    {
      refKey: "checkpointPanel",
      title: "Or jump directly",
      body: "Click any checkpoint card to jump to that year instantly. Each card reveals observations, evidence, and a policy question to consider.",
      arrowSide: "left",
    },
    {
      refKey: "skipBtn",
      title: "Want to explore freely?",
      body: "Skip the guided story at any time to unlock the timeline slider and explore every year on your own terms.",
      arrowSide: "left",
    },
    {
      refKey: "sliderContainer",
      title: "Scrub through time",
      body: "After visiting all checkpoints, drag this slider to move year by year from 2015 to 2024 and watch EV adoption spread across the state.",
      arrowSide: "top",
    },
    {
      refKey: "mapContainer",
      title: "Explore the map",
      body: "Hover over any hexagon to see the cumulative EV registration count for that area. Darker teal = higher density. Toggle charging stations to compare infrastructure coverage.",
      arrowSide: "right",
    },
  ];

  const tutorialRefs: Record<string, React.RefObject<HTMLElement | null>> = {
    nextBtn: nextBtnRef as React.RefObject<HTMLElement | null>,
    checkpointPanel: checkpointPanelRef as React.RefObject<HTMLElement | null>,
    skipBtn: skipBtnRef as React.RefObject<HTMLElement | null>,
    sliderContainer: sliderContainerRef as React.RefObject<HTMLElement | null>,
    mapContainer: mapContainerRef as React.RefObject<HTMLElement | null>,
  };
  

  useEffect(() => {
    (async () => {
      // State outline for projection fitting and background fill
      const geo: any = await d3.json("/geo/us-states.json");
      const waOnly = {
        type: "FeatureCollection",
        features: geo.features.filter((f: any) => f.properties.name === "Washington"),
      };
      setWaGeo(waOnly);

      // Simplified county boundaries — same lon/lat CRS, rendered with same Mercator path
      const counties: any = await d3.json("/geo/wa-counties-simple.geojson");
      setWaCounties(counties);

      const ev = await d3.csv("/data/Electric_Vehicle_Population_Data_20260224.csv", (d) => ({
        ["Model Year"]: toNumber((d as any)["Model Year"]),
        ["Electric Vehicle Type"]: String((d as any)["Electric Vehicle Type"] ?? ""),
        ["Vehicle Location"]: String((d as any)["Vehicle Location"] ?? ""),
        County: String((d as any)["County"] ?? ""),
      } as EvRow));
      setEvRows(ev as EvRow[]);

      const st = await d3.csv("/data/alt_fuel_stations (Feb 24 2026).csv", (d) => {
        const openYear = parseYear((d as any)["Open Date"]) ?? null;
        return {
          Latitude: toNumber((d as any)["Latitude"]),
          Longitude: toNumber((d as any)["Longitude"]),
          ["EV Level2 EVSE Num"]: toNumber((d as any)["EV Level2 EVSE Num"]),
          ["EV DC Fast Count"]: toNumber((d as any)["EV DC Fast Count"]),
          openYear,
        } as StationRow;
      });
      setStations((st as StationRow[]).filter((r) => r.Latitude && r.Longitude));
    })();
  }, []);

    // === GUIDED STORY ON LOAD ===
  useEffect(() => {
    setInGuidedMode(true);
    setActiveCheckpoint(0);
    setYear(CHECKPOINTS[0].year);
    setVisitedCheckpoints(new Set([0]));
  }, []);

    const handleCheckpointClick = (i: number) => {
    setActiveCheckpoint(i);
    setYear(CHECKPOINTS[i].year);
    setVisitedCheckpoints((prev) => {
      const next = new Set(prev);
      next.add(i);
      if (next.size === CHECKPOINTS.length) {
        setInGuidedMode(false);
        setUnlocked(true);
      }
      return next;
    });
  };

  // === NEW: Manual Next button handler ===
  const handleNext = () => {
    if (!inGuidedMode) return;

    const nextIdx = activeCheckpoint + 1;
    if (nextIdx >= CHECKPOINTS.length) {
      setInGuidedMode(false);
      setUnlocked(true);
      return;
    }

    setActiveCheckpoint(nextIdx);
    setYear(CHECKPOINTS[nextIdx].year);
    setVisitedCheckpoints((prev) => {
      const newSet = new Set(prev);
      newSet.add(nextIdx);
      if (newSet.size === CHECKPOINTS.length) {
        setInGuidedMode(false);
        setUnlocked(true);
      }
      return newSet;
    });
    setNextReminder(false);
  };

  // === NEW: Reminder highlight after 12 seconds of inactivity ===
  useEffect(() => {
    if (!inGuidedMode) {
      setNextReminder(false);
      return;
    }
    setNextReminder(false);

    const timer = setTimeout(() => {
      setNextReminder(true);
    }, 12000); // 12 seconds → highlight the Next button

    return () => clearTimeout(timer);
  }, [inGuidedMode, activeCheckpoint]);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setYear((y) => {
        if (y >= YEAR_MAX) { setIsPlaying(false); return YEAR_MAX; }
        return y + 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying]);

  const years = useMemo(() => d3.range(YEAR_MIN, YEAR_MAX + 1), []);

  const prepared = useMemo(() => {
    if (!waGeo) return null;

    const projection = d3.geoMercator();
    const path = d3.geoPath(projection);
    projection.fitExtent([[4, 12], [width - 8, height - 15]], waGeo);

    // --- Single pass through evRows for all derived data ---
    const pointsByYear = new Map<number, [number, number][]>();
    const bevByYear = new Map<number, number>();
    const phevByYear = new Map<number, number>();
    const catCountByYear = new Map<number, Record<string, number>>();
    for (const y of years) {
      pointsByYear.set(y, []);
      bevByYear.set(y, 0);
      phevByYear.set(y, 0);
      catCountByYear.set(y, { Urban: 0, Suburban: 0, Rural: 0 });
    }

    for (const r of evRows) {
      const y = r["Model Year"];
      if (y < YEAR_MIN || y > YEAR_MAX) continue;

      // Map point
      const ll = parsePointWKT(r["Vehicle Location"]);
      if (ll) {
        const p = projection([ll.lon, ll.lat]);
        if (p) pointsByYear.get(y)!.push([p[0], p[1]]);
      }

      // BEV/PHEV count
      const t = r["Electric Vehicle Type"];
      if (t.includes("Battery Electric")) bevByYear.set(y, bevByYear.get(y)! + 1);
      else if (t.includes("Plug-in Hybrid")) phevByYear.set(y, phevByYear.get(y)! + 1);

      // Urban/Rural count
      const cat = COUNTY_CLASS[r.County];
      if (cat) catCountByYear.get(y)![cat]++;
    }

    // Build cumulative structures in one forward pass each
    const evByYear = new Map<number, [number, number][]>();
    const allPoints: [number, number][] = [];
    const bevPhevByYear: BevPhevRow[] = [];
    let cumBev = 0, cumPhev = 0;

    const catPop: Record<string, number> = { Urban: 0, Suburban: 0, Rural: 0 };
    for (const [county, cat] of Object.entries(COUNTY_CLASS)) {
      catPop[cat] += COUNTY_POP[county] ?? 0;
    }
    const urbanRuralByYear: UrbanRuralRow[] = [];
    const catCum: Record<string, number> = { Urban: 0, Suburban: 0, Rural: 0 };

    for (const y of years) {
      // Points — push into shared array, store snapshot as a view via length marker
      const pts = pointsByYear.get(y)!;
      for (const pt of pts) allPoints.push(pt);
      evByYear.set(y, allPoints.slice()); // shallow copy of current cumulative

      // BEV/PHEV cumulative
      cumBev += bevByYear.get(y)!;
      cumPhev += phevByYear.get(y)!;
      bevPhevByYear.push({ year: y, bev: cumBev, phev: cumPhev, total: cumBev + cumPhev });

      // Urban/Rural cumulative
      const cc = catCountByYear.get(y)!;
      catCum.Urban += cc.Urban;
      catCum.Suburban += cc.Suburban;
      catCum.Rural += cc.Rural;
      urbanRuralByYear.push({
        year: y,
        Urban: (catCum.Urban / catPop.Urban) * 1000,
        Suburban: (catCum.Suburban / catPop.Suburban) * 1000,
        Rural: (catCum.Rural / catPop.Rural) * 1000,
      });
    }

    // globalMax: only bin the final (largest) year — avoids 10x hexbin computation
    const hbTemp = d3Hexbin<[number, number]>().radius(14).extent([[0, 0], [width, height]]);
    const lastBins = hbTemp(evByYear.get(YEAR_MAX)!);
    const counts = lastBins.map((b) => b.length).sort(d3.ascending);
    const globalMax = d3.quantile(counts, 0.90) ?? 1;

    const stProjected = stations
      .map((s) => {
        const p = projection([s.Longitude, s.Latitude]);
        if (!p) return null;
        const level2 = s["EV Level2 EVSE Num"] > 0;
        const dcfast = s["EV DC Fast Count"] > 0;
        const kind = dcfast ? "dcfast" : level2 ? "level2" : "other";
        return { x: p[0], y: p[1], kind, openYear: s.openYear };
      })
      .filter(Boolean) as { x: number; y: number; kind: "dcfast" | "level2" | "other"; openYear: number | null }[];

    return { projection, path, evByYear, stProjected, globalMax, bevPhevByYear, urbanRuralByYear };
  }, [waGeo, evRows, stations, width, height, years]);

  useEffect(() => {
    if (!prepared || !svgRef.current) return;

    const { path, evByYear, stProjected, globalMax } = prepared;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");

    // clipPath from state outline (us-states.json Mercator projection)
    defs.append("clipPath").attr("id", "wa-clip")
      .append("path").datum(waGeo).attr("d", path as any);

    const gMap = svg.append("g");
    const gCounties = svg.append("g").attr("clip-path", "url(#wa-clip)");
    const gHex = svg.append("g").attr("clip-path", "url(#wa-clip)");
    const gStations = svg.append("g").attr("clip-path", "url(#wa-clip)");

    // State background fill — no outer stroke to avoid misalignment with county edges
    gMap.append("path").datum(waGeo)
      .attr("d", path as any)
      .attr("fill", "#f0f6ff")
      .attr("stroke", "none");

    // County boundary lines — same Mercator path, clipped to state outline
    if (waCounties) {
      gCounties.selectAll("path.county")
        .data((waCounties as any).features)
        .enter()
        .append("path")
        .attr("class", "county")
        .attr("d", path as any)
        .attr("fill", "none")
        .attr("stroke", "#64748b")
        .attr("stroke-width", 0.6)
        .attr("stroke-dasharray", "3,3")
        .attr("stroke-opacity", 0.55);
    }
    const hb = d3Hexbin<[number, number]>().radius(14).extent([[0, 0], [width, height]]);
    const color = d3.scaleSequential(d3.interpolateGnBu).domain([0, globalMax]);
    const bins = hb(evByYear.get(year) ?? []);

    const hex = gHex.selectAll<SVGPathElement, any>("path.hex")
      .data(bins, (d: any) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`);

    const hexEnter = hex.enter().append("path").attr("class", "hex")
      .attr("d", hb.hexagon())
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .attr("fill", (d: any) => color(d.length))
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#333")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 0.5);

    hexEnter
      .on("mousemove", function (_event: MouseEvent, d: any) {
        const svgEl = svgRef.current!;
        const rect = svgEl.getBoundingClientRect();
        const scaleX = rect.width / width;
        setTooltip({
          x: d.x * scaleX + rect.left,
          y: d.y * scaleX + rect.top,
          count: d.length,
        });
      })
      .on("mouseleave", () => setTooltip(null))
      .style("cursor", "pointer");

    hexEnter.merge(hex as any)
      .transition().duration(650).ease(d3.easeCubicInOut)
      .attr("fill", (d: any) => color(d.length));

    hex.exit().remove();

    if (showStations) {
      const stationsInYear = stProjected.filter((s) => s.openYear == null || s.openYear <= year);
      gStations.selectAll("circle.station").data(stationsInYear).enter().append("circle")
        .attr("class", "station").attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", 5)
        .attr("fill", "#f59e0b").attr("fill-opacity", 0.9)
        .attr("stroke", "#92400e").attr("stroke-opacity", 0.5).attr("stroke-width", 0.8);
    }

    const legendW = 140;
    const legendX = 16;
    const legendY = height - 62;
    const gradId = "grad-evdensity";
    const lg = defs.append("linearGradient").attr("id", gradId);
    lg.attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
    d3.range(0, 1.01, 0.1).forEach((t) => {
      lg.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(t * globalMax));
    });

    const legend = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`);
    legend.append("text").attr("x", 0).attr("y", 0).attr("font-size", 11).attr("fill", "#334155")
      .attr("font-family", "system-ui, -apple-system, Segoe UI, Roboto, Arial").text("EV Density");
    legend.append("rect").attr("x", 0).attr("y", 14).attr("width", legendW).attr("height", 10)
      .attr("fill", `url(#${gradId})`).attr("stroke", "#cbd5e1").attr("stroke-width", 0.6).attr("rx", 2);
    legend.append("text").attr("x", 0).attr("y", 36).attr("font-size", 10).attr("fill", "#64748b").text("Low");
    legend.append("text").attr("x", legendW).attr("y", 36).attr("text-anchor", "end")
      .attr("font-size", 10).attr("fill", "#64748b").text("High");

    if (showStations) {
      const stLegend = svg.append("g").attr("transform", `translate(${legendX + legendW + 20}, ${legendY})`);
      stLegend.append("text").attr("x", 0).attr("y", 0).attr("font-size", 11).attr("fill", "#334155")
        .attr("font-family", "system-ui, -apple-system, Segoe UI, Roboto, Arial").text("Charging Station");
      stLegend.append("circle").attr("cx", 7).attr("cy", 21).attr("r", 5)
        .attr("fill", "#f59e0b").attr("stroke", "#92400e").attr("stroke-width", 0.8);
      stLegend.append("text").attr("x", 18).attr("y", 25).attr("font-size", 10).attr("fill", "#64748b").text("Station");
    }
  }, [prepared, waGeo, waCounties, year, showStations, width, height]);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", display: "grid", gap: 12, width: "90vw", maxWidth: 1400, margin: "0 auto" }}>

      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 14,
          top: tooltip.y - 42,
          background: "#1e293b",
          color: "#f8fafc",
          fontSize: 12,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
          padding: "6px 11px",
          borderRadius: 7,
          pointerEvents: "none",
          zIndex: 1000,
          boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
          whiteSpace: "nowrap",
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700 }}>{tooltip.count.toLocaleString()} EVs registered</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>cumulative through {year}</div>
        </div>
      )}

            <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#f0f6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 18px",
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1e3a5f" }}>
            Can EV adoption cross Washington's urban-rural divide?
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            And where are the charging infrastructure gaps policymakers must address?
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {inGuidedMode && (
            <button
              ref={nextBtnRef}
              onClick={handleNext}
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                border: nextReminder ? "2px solid #f59e0b" : "1.5px solid #0ea5e9",
                background: nextReminder ? "#f59e0b" : "#0ea5e9",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13.5,
                cursor: "pointer",
                transition: "all 0.3s ease",
                transform: nextReminder ? "scale(1.06)" : "scale(1)",
                boxShadow: nextReminder ? "0 0 14px rgba(245, 158, 11, 0.65)" : "none",
                whiteSpace: "nowrap",
              }}
            >
              {nextReminder ? "Next → Continue Story" : "Next Checkpoint →"}
            </button>
          )}

          <button
            onClick={() => setShowStations((s) => !s)}
            style={{ ...btnBase, border: "1.5px solid #f59e0b", background: showStations ? "#fffbeb" : "#f8fafc", color: "#92400e", fontWeight: 600, whiteSpace: "nowrap" }}
          >
            ⚡ Charging Stations {showStations ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>

        {/* Left column: map + slider + two side-by-side charts */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div ref={mapContainerRef} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }} />
          </div>
          <div ref={sliderContainerRef} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 18px", background: "#fafafa" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>{YEAR_MIN}</span>
              <div style={{ flex: 1, position: "relative" }}>
                <input type="range" min={YEAR_MIN} max={YEAR_MAX} step={1} value={year}
                  disabled={!unlocked} onChange={(e) => setYear(Number(e.target.value))}
                  style={{ width: "100%", opacity: unlocked ? 1 : 0.35, cursor: unlocked ? "pointer" : "not-allowed" }}
                />
                <div style={{
                  position: "absolute", top: -22,
                  left: `${((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100}%`,
                  transform: "translateX(-50%)", fontWeight: 700, fontSize: 13, color: "#0369a1", pointerEvents: "none",
                }}>{year}</div>
              </div>
              <span style={{ fontSize: 12, color: "#64748b" }}>{YEAR_MAX}</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
              {unlocked ? "◄ drag to explore ►" : "◄ drag to explore ►  (locked — click all checkpoints to unlock)"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", background: "#fafcff" }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1e3a5f", marginBottom: 2 }}>BEV vs. PHEV Share Over Time</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>→ Growing BEV share = growing charging infrastructure demand</div>
              <BevPhevChart data={prepared?.bevPhevByYear ?? []} currentYear={year} />
            </div>
            <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", background: "#fafcff" }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1e3a5f", marginBottom: 2 }}>EV Density: Urban vs Suburban vs Rural</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>→ Is the urban-rural adoption gap narrowing or widening?</div>
              <UrbanRuralChart data={prepared?.urbanRuralByYear ?? []} currentYear={year} />
            </div>
          </div>
        </div>

        {/* Right column: checkpoint panel — spans full combined height naturally */}
        <div style={{ width: 340, flexShrink: 0, display: "flex" }}>
          <div ref={checkpointPanelRef} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px", background: "#fafcff", display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1e3a5f", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#0369a1" }}>▶</span> Story Checkpoint
            </div>
                      {CHECKPOINTS.map((cp, i) => {
            const isActive = activeCheckpoint === i;
            const isVisited = visitedCheckpoints.has(i);
            const cpColor = CHECKPOINT_COLORS[i];

            return (
              <div
                key={i}
                onClick={() => handleCheckpointClick(i)}
                style={{
                  padding: isActive ? "14px 12px" : "10px 12px",
                  borderRadius: 10,
                  border: `1.5px solid ${isActive ? cpColor : "#e2e8f0"}`,
                  background: isActive ? "#f0f9ff" : isVisited ? "#fafafa" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.35s ease-in-out",
                  boxShadow: isActive
                    ? `0 4px 20px ${cpColor}22, 0 0 0 3px ${cpColor}22`
                    : "none",

                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: cpColor }}>
                    {cp.label}
                  </div>
                  {isVisited && !isActive && (
                    <span style={{ color: "#10b981", fontSize: 14 }}>✅</span>
                  )}
                </div>

                <div
                  style={{
                    marginTop: isActive ? 10 : 0,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#1e2937",
                    opacity: isActive ? 1 : 0,
                    maxHeight: isActive ? "400px" : "0px",
                    overflow: "hidden",
                    transition: "all 0.4s ease-in-out",
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#1e40af", fontSize: 12 }}>Look: </strong>
                    {cp.observation}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong style={{ color: "#1e40af", fontSize: 12 }}>Evidence: </strong>
                    {cp.evidence}
                  </div>
                  <div style={{ background: "#f0fdf4", borderLeft: "3px solid #059669", padding: "6px 8px", borderRadius: "0 4px 4px 0" }}>
                    <strong style={{ color: "#059669", fontSize: 12 }}>Policy question: </strong>
                    {cp.policyInsight}
                  </div>
                </div>
              </div>
            );
          })}

            {/* Guided Story + Unlock box */}
            <div
              style={{
                border: "1.5px dashed #cbd5e1",
                borderRadius: 8,
                padding: "10px 12px",
                background: inGuidedMode ? "#f0fdf4" : "#f8fafc",
              }}
            >
              {inGuidedMode ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#059669", marginBottom: 4 }}>
                    📖 Guided Story Mode
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
                    Click <strong>Next Checkpoint</strong> above to advance
                  </div>
                  <button
                    ref={skipBtnRef}
                    onClick={() => { setInGuidedMode(false); setUnlocked(true); }}
                    style={{ width: "100%", padding: "8px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                  >
                    Skip to Full Exploration →
                  </button>
                </>
              ) : unlocked ? (
                <>
                  <div style={{ fontSize: 11, color: "#059669", fontWeight: 600, marginBottom: 6 }}>🔓 Exploration mode unlocked</div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>"Does infrastructure lead adoption — or follow it?"</div>
                  <button
                    onClick={() => {
                      if (!isPlaying) setYear(YEAR_MIN);
                      setIsPlaying((p) => !p);
                    }}
                    style={{ width: "100%", ...btnBase, background: isPlaying ? "#fef3c7" : "#0ea5e9", border: isPlaying ? "1px solid #f59e0b" : "1px solid #0284c7", color: isPlaying ? "#92400e" : "#fff" }}
                  >
                    {isPlaying ? "⏸ Pause" : "▶ Auto Play"}
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                  Click all checkpoints to unlock exploration
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
      {showTutorial && (
        <TutorialOverlay
          steps={tutorialSteps}
          refs={tutorialRefs}
          onDone={() => setShowTutorial(false)}
        />
      )}
    </div>
  );
}
