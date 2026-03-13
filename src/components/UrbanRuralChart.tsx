import { useEffect, useRef } from "react";
import * as d3 from "d3";

export type UrbanRuralRow = {
  year: number;
  Urban: number;
  Suburban: number;
  Rural: number;
};

type Props = {
  data: UrbanRuralRow[];
  currentYear: number;
};

// Always show 2015 as baseline + fixed reference years + currentYear
const BASE_YEARS = [2018, 2020, 2022];

const YEAR_COLORS: Record<number, string> = {
  2015: "#a5c8fd",
  2018: "#93c5fd",
  2020: "#60a5fa",
  2022: "#3b82f6",
};

export default function UrbanRuralChart({ data, currentYear }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const W = 560, H = 210;
    const margin = { top: 24, right: 20, bottom: 38, left: 58 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const categories = ["Urban", "Suburban", "Rural"] as const;

    // Include 2015 baseline only when currentYear is one of the fixed reference years (4-bar balance)
    const fixedRefYears = [2018, 2020, 2022];
    const includeBaseline = fixedRefYears.includes(currentYear);
    const baseSet = includeBaseline ? [2015, ...BASE_YEARS] : BASE_YEARS;
    const displayYears = [...new Set([...baseSet, currentYear])].sort((a, b) => a - b);

    const currentColor = "#1d4ed8";
    const getColor = (yr: number) => yr === currentYear ? currentColor : (YEAR_COLORS[yr] ?? "#60a5fa");

    const xOuter = d3.scaleBand().domain(categories).range([0, innerW]).paddingInner(0.3);
    const xInner = d3.scaleBand()
      .domain(displayYears.map(String))
      .range([0, xOuter.bandwidth()])
      .padding(0.1);

    const maxVal = d3.max(data, (d) => Math.max(d.Urban, d.Suburban, d.Rural)) ?? 1;
    const yScale = d3.scaleLinear().domain([0, maxVal * 1.15]).range([innerH, 0]);

    g.append("g").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xOuter))
      .selectAll("text").attr("font-size", 11).attr("font-weight", 600);

    g.append("g")
      .call(d3.axisLeft(yScale).ticks(4).tickFormat((d) => d3.format(".1f")(d as number)))
      .selectAll("text").attr("font-size", 10);

    g.append("text").attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -44).attr("text-anchor", "middle")
      .attr("font-size", 10).attr("fill", "#64748b").text("EVs per 1,000 residents");

    // Draw bars and collect currentYear bar midpoints for the connecting line
    const curMidpoints: { cat: string; x: number; y: number }[] = [];

    for (const cat of categories) {
      const catOffset = xOuter(cat) ?? 0;
      const catG = g.append("g").attr("transform", `translate(${catOffset},0)`);
      for (const yr of displayYears) {
        const row = data.find((d) => d.year === yr);
        if (!row) continue;
        const val = row[cat];
        const barX = xInner(String(yr)) ?? 0;
        const barW = xInner.bandwidth();
        catG.append("rect")
          .attr("x", barX)
          .attr("y", yScale(val))
          .attr("width", barW)
          .attr("height", innerH - yScale(val))
          .attr("fill", getColor(yr))
          .attr("fill-opacity", yr === currentYear ? 1 : 0.65)
          .attr("rx", 2);

        if (yr === currentYear) {
          // midpoint of top edge of current-year bar, in g coordinates
          curMidpoints.push({
            cat,
            x: catOffset + barX + barW / 2,
            y: yScale(val),
          });
        }
      }
    }

    // Draw dashed polyline connecting tops of currentYear bars across Urban→Suburban→Rural
    if (curMidpoints.length === 3) {
      const lineData = categories.map((cat) => curMidpoints.find((p) => p.cat === cat)!);
      const lineGen = d3.line<{ x: number; y: number }>()
        .x((d) => d.x)
        .y((d) => d.y);
      g.append("path")
        .datum(lineData)
        .attr("d", lineGen as any)
        .attr("fill", "none")
        .attr("stroke", currentColor)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,3")
        .attr("opacity", 0.8);

      // Small circles at each midpoint
      for (const pt of lineData) {
        g.append("circle")
          .attr("cx", pt.x).attr("cy", pt.y).attr("r", 3)
          .attr("fill", currentColor).attr("opacity", 0.9);
      }
    }



    // Legend — spread evenly across bottom
    const legendG = g.append("g").attr("transform", `translate(0, ${innerH + 20})`);
    const legendSpacing = innerW / displayYears.length;
    displayYears.forEach((yr, i) => {
      const lx = i * legendSpacing;
      legendG.append("rect").attr("x", lx).attr("y", 0).attr("width", 10).attr("height", 10)
        .attr("fill", getColor(yr)).attr("fill-opacity", yr === currentYear ? 1 : 0.65).attr("rx", 2);
      legendG.append("text").attr("x", lx + 14).attr("y", 9)
        .attr("font-size", 9).attr("fill", "#475569")
        .text(yr === currentYear ? `${yr} (now)` : String(yr));
    });
  }, [data, currentYear]);

  return <svg ref={svgRef} width="100%" style={{ display: "block" }} />;
}
