# The Geographic Spread of Electric Vehicles Across Washington State

**ECS 272 Final Project — Team 8**  
Jia Zuo · Ziqi Cheng · UC Davis · March 2026

---

## Project Overview

This project is an interactive data visualization dashboard that tells the 
story of how electric vehicle (EV) adoption evolved across Washington State 
from 2015 to 2024, and what it means for charging infrastructure policy.

The dashboard is built around two research questions:
1. Can EV adoption truly cross Washington's urban-rural divide — or are 
   rural communities being left behind?
2. Where are the charging infrastructure gaps that policymakers must 
   address to meet this growing demand?

The target audience is **local policymakers** who need to identify geographic
gaps between EV adoption demand and charging infrastructure supply.

---

## Key Features

### Animated Hexbin Map (Main Visualization)
- Hexagonal binning of 180,000+ EV registrations across Washington State
- Color encoding (GnBu sequential scale) represents EV density per hex cell
- Color domain calibrated to the **90th percentile** of 2024 bin counts,
  preventing King County outliers from washing out variation elsewhere
- Timeline slider (2015–2024) animates cumulative EV adoption year by year
- **Charging station overlay** (toggleable): NREL station locations rendered
  as amber markers, synchronized to the timeline by each station's open date
- County boundary lines rendered from simplified GeoJSON with SVG clipPath masking

### BEV vs. PHEV Stacked Area Chart (Bottom Left)
- Shows the proportion of Battery Electric Vehicles vs. Plug-in Hybrid 
  Electric Vehicles over time
- Synchronized with the main timeline slider
- BEV/PHEV distinction is retained (rather than "EV vs. Hybrid") because 
  BEVs depend entirely on public charging — a direct policy implication
- Vertical dashed line tracks the currently selected year

### Urban vs. Suburban vs. Rural Bar Chart (Bottom Right)
- Compares EV density (EVs per 1,000 residents) across county tiers:
  Urban (5 counties), Suburban (9 counties), Rural (25 counties)
- Per-capita normalization corrects for population size differences
- Reference bars at 2018, 2020, 2022 plus the currently selected year
- Dashed polyline connects current-year bars to emphasize the gap slope

### Martini Glass Storytelling Structure
- **Guided phase**: Timeline slider is locked; user advances through 
  4 narrative checkpoints via "Next Checkpoint" button
- Each checkpoint displays structured **Look / Evidence / Policy Question** 
  panels alongside the map
- "Next Checkpoint" button pulses amber after 12 seconds of inactivity
- **Free exploration** unlocks after all 4 checkpoints are visited, 
  or user clicks "Skip to Full Exploration"
- Auto Play always resets to 2015 before playing

### Four Story Checkpoints
| Checkpoint | Year | Key Insight |
|---|---|---|
| 1 | 2015–2017 | Early Adopters: King County only, luxury product |
| 2 | 2018–2019 | The Model 3 Effect: affordability drives suburban spread |
| 3 | 2020–2021 | COVID Dip + Policy Rebound: rebates held the floor |
| 4 | 2022–2024 | Statewide Wave — The Gap Persists: Eastern WA infrastructure desert |

### Tutorial Overlay
- Five-step onboarding spotlight shown on first load
- Highlights: Next button → checkpoint panel → Skip button → slider → map
- Advances on any click; dismissable at any step

### Hexbin Tooltip
- Hover any hexbin cell to see county name and EV count

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Visualization | D3.js v7 + d3-hexbin 0.2.2 |
| Geographic data | GeoJSON via d3.geoPath (Mercator projection) |
| Styling | Inline styles + CSS-in-JS |

**Component structure:**
```
src/
├── AnimatedHexbinMap.tsx   # Main container, hexbin map, state management
├── BevPhevChart.tsx        # BEV/PHEV stacked area chart
├── UrbanRuralChart.tsx     # Urban/Suburban/Rural bar chart
└── TutorialOverlay.tsx     # First-load onboarding overlay
```

---

## Data Sources

| Dataset | Source | Records |
|---|---|---|
| WA State EV Population | WA Dept. of Licensing via Data.gov | 180,000+ |
| Alternative Fuel Stations | NREL / U.S. Dept. of Energy AFDC | 2,700+ |
| WA County Boundaries | WA State administrative data (RDP-simplified) | 39 counties |
| WA State Boundary | Natural Earth (via us-states.json) | — |

**Note on Model Year proxy:** The EV dataset is a current snapshot, not a 
historical archive. We use `Model Year ≤ target year` to approximate the 
cumulative fleet at each point in time. This assumes low EV deregistration 
rates, which is supported by existing literature.

---

## Setup and Running

### Prerequisites
- Node.js ≥ 18
- npm or yarn

### Installation and Running
Download the entire project and then execute it in the root directory.

### Running
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Performance Notes

With 180,000+ EV records, several optimizations were applied:

- **Single-pass processing**: coordinate projection, BEV/PHEV counting, and 
  urban/rural counting merged into one loop (O(3n) → O(n))
- **Forward-pass cumulative aggregation**: replaces O(years × n) nested loops
- **GeoJSON simplification**: county boundary reduced from 4.4 MB / 108,718 
  points to 119 KB / 2,566 points (98% reduction) via RDP simplification
- **globalMax from 2024 only**: 90th-percentile color scale computed once 
  from the final cumulative year

Some frame-rate variability may occur during fast timeline scrubbing on 
lower-end hardware. The hexbin recomputation per frame remains the 
primary bottleneck.

---

## Known Limitations

1. **Model Year proxy**: may slightly overcount early-year adoption in 
   high-turnover urban areas
2. **Northern border misalignment**: county boundary dashed lines show a 
   slight visual artifact at Washington's northern border, arising from 
   different coordinate resolutions in the state outline (Natural Earth) 
   and county data (WA State administrative). A robust fix would require 
   unifying both sources via us-atlas topojson with WA FIPS filtering.
3. **California comparison not implemented**: CA dataset (~1.8M records) 
   is ~10× larger than WA; interactive performance would require a 
   WebGL-based pipeline (e.g., deck.gl) beyond the scope of this project.

---

## Team

| Member | Responsibilities |
|---|---|
| Jia Zuo | Visualization architecture, AnimatedHexbinMap component, storytelling structure, report writing |
| Ziqi Cheng | Debugging, BevPhevChart, UrbanRuralChart, data validation |
| Both | Visual design, narrative content |

---

## References

1. Segel & Heer, "Narrative Visualization: Telling Stories with Data," IEEE TVCG 2010
2. Moritz et al., "Trust, but Verify," ACM CHI 2015
3. Tversky et al., "Animation: Can it Facilitate?" IJHCS 2002
4. Egbue & Long, "Barriers to Widespread Adoption of EVs," Energy Policy 2012
5. Sierzchula et al., "The Influence of Financial Incentives on EV Adoption," Energy Policy 2014
6. Washington State Transportation Commission, WA EV Action Plan, 2022
7. Douglas & Peucker, "Algorithms for the Reduction of Points," Cartographica 1973
