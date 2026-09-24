import { render } from "preact";
import { App } from "./App.jsx";
import "./styles.css";
import { applyTheme, loadTheme } from "./lib/theme.js";

applyTheme(loadTheme()); // before first paint — no theme flash

render(<App />, document.getElementById("app"));
