import { useEffect, useRef } from "react";
import * as d3 from "d3";

export type BevPhevRow = {
  year: number;
  bev: number;
  phev: number;
  total: number;
};

type Props = {
  data: BevPhevRow[];
  currentYear: number;
};

const YEAR_MIN = 2015;
const YEAR_MAX = 2024;

export default function BevPhevChart({ data, currentYear }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const W = 560, H = 200;
    const margin = { top: 24, right: 20, bottom: 32, left: 52 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([YEAR_MIN, YEAR_MAX]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

    const stackData = data.map((d) => ({
      year: d.year,
      bevShare: d.total > 0 ? d.bev / d.total : 0.75,
      phevShare: d.total > 0 ? d.phev / d.total : 0.25,
    }));

    const areaPhev = d3.area<(typeof stackData)[0]>()
      .x((d) => xScale(d.year))
      .y0(yScale(0))
      .y1((d) => yScale(d.phevShare))
      .curve(d3.curveCatmullRom);

    const areaBev = d3.area<(typeof stackData)[0]>()
      .x((d) => xScale(d.year))
      .y0((d) => yScale(d.phevShare))
      .y1(yScale(1))
      .curve(d3.curveCatmullRom);

    const lineBoundary = d3.line<(typeof stackData)[0]>()
      .x((d) => xScale(d.year))
      .y((d) => yScale(d.phevShare))
      .curve(d3.curveCatmullRom);

    g.append("path").datum(stackData).attr("d", areaPhev as any)
      .attr("fill", "#d97706").attr("fill-opacity", 0.75);

    g.append("path").datum(stackData).attr("d", areaBev as any)
      .attr("fill", "#6ee7b7").attr("fill-opacity", 0.85);

    g.append("path").datum(stackData).attr("d", lineBoundary as any)
      .attr("fill", "none").attr("stroke", "white")
      .attr("stroke-width", 2).attr("stroke-dasharray", "6,3").attr("opacity", 0.8);

    g.append("g").attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat((d) => String(d)))
      .selectAll("text").attr("font-size", 10);

    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${Math.round((d as number) * 100)}%`))
      .selectAll("text").attr("font-size", 10);

    g.append("text").attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2).attr("y", -40).attr("text-anchor", "middle")
      .attr("font-size", 10).attr("fill", "#64748b").text("Share of registrations");

    const midYear = stackData.find((d) => d.year === 2019) ?? stackData[2];
    g.append("text")
      .attr("x", xScale(2019)).attr("y", yScale((midYear.phevShare + 1) / 2))
      .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600).attr("fill", "#065f46")
      .text("BEV share ↑");

    g.append("text")
      .attr("x", xScale(2019)).attr("y", yScale(midYear.phevShare / 2))
      .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600).attr("fill", "#92400e")
      .text("PHEV share ↓");

    const curRow = stackData.find((d) => d.year === currentYear);
    if (curRow) {
      const xPos = xScale(currentYear);
      g.append("line")
        .attr("x1", xPos).attr("x2", xPos).attr("y1", 0).attr("y2", innerH)
        .attr("stroke", "#f59e0b").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,3");

      const bevPct = Math.round(curRow.bevShare * 100);
      const phevPct = 100 - bevPct;

      // Flip badges to the left side for years near the right edge to avoid overflow
      const flipLeft = currentYear >= 2022;
      const badgeW = 76;
      const badgeX = flipLeft ? xPos - badgeW - 6 : xPos + 6;
      const yearLabelX = flipLeft ? xPos - 4 : xPos + 4;
      const yearAnchor = flipLeft ? "end" : "start";

      g.append("text").attr("x", yearLabelX).attr("y", 12)
        .attr("font-size", 10).attr("font-weight", 600).attr("fill", "#f59e0b")
        .attr("text-anchor", yearAnchor)
        .text(`▼ ${currentYear}`);

      g.append("rect")
        .attr("x", badgeX).attr("y", yScale(curRow.phevShare + (1 - curRow.phevShare) / 2) - 20)
        .attr("width", 70).attr("height", 18).attr("rx", 4).attr("fill", "#065f46").attr("fill-opacity", 0.85);
      g.append("text")
        .attr("x", badgeX + 35).attr("y", yScale(curRow.phevShare + (1 - curRow.phevShare) / 2) - 7)
        .attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700).attr("fill", "#fff")
        .text(`BEV: ~${bevPct}%`);

      g.append("rect")
        .attr("x", badgeX).attr("y", yScale(curRow.phevShare / 2) - 20)
        .attr("width", badgeW).attr("height", 18).attr("rx", 4).attr("fill", "#92400e").attr("fill-opacity", 0.85);
      g.append("text")
        .attr("x", badgeX + badgeW / 2).attr("y", yScale(curRow.phevShare / 2) - 7)
        .attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 700).attr("fill", "#fff")
        .text(`PHEV: ~${phevPct}%`);
    }

    const legendG = g.append("g").attr("transform", `translate(0, ${innerH + 18})`);
    const items = [
      { color: "#6ee7b7", label: "BEV (pure battery — needs public charging)" },
      { color: "#d97706", label: "PHEV (plug-in hybrid — lower dependency)" },
    ];
    items.forEach((item, i) => {
      legendG.append("rect").attr("x", i * 260).attr("y", 0).attr("width", 12).attr("height", 12)
        .attr("fill", item.color).attr("rx", 2);
      legendG.append("text").attr("x", i * 260 + 16).attr("y", 10)
        .attr("font-size", 10).attr("fill", "#475569").text(item.label);
    });
  }, [data, currentYear]);

  return <svg ref={svgRef} width="100%" style={{ display: "block" }} />;
}
