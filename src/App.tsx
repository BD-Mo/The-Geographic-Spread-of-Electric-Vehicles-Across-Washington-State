import AnimatedHexbinMap from "./components/AnimatedHexbinMap";
import "./App.css";

export default function App() {
  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ margin: "6px 0 6px" }}>Can EV adoption cross Washington&apos;s urban-rural divide?</h2>
      <div style={{ color: "#64748b", marginBottom: 12 }}>
        Animated hexbin density (2015–2024) + charging station overlay
      </div>

      <AnimatedHexbinMap width={1060} height={560} />
    </div>
  );
}
