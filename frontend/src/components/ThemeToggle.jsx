import { useEffect, useState } from "react";
import { currentTheme, setTheme } from "../theme";

export default function ThemeToggle({ onDark }) {
  const [t, setT] = useState(currentTheme());
  useEffect(() => { const f = () => setT(currentTheme()); window.addEventListener("kept:theme", f); return () => window.removeEventListener("kept:theme", f); }, []);
  const dark = t === "dark";
  return (
    <button className="btn btn-icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      style={onDark ? { background: "rgba(255,255,255,.1)", borderColor: "rgba(255,255,255,.2)", color: "#fff" } : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 7a5 5 0 100 10 5 5 0 000-10z" />
          : <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />}
      </svg>
    </button>
  );
}
