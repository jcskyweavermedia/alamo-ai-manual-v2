import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force rebuild - triggers fresh Tailwind compilation
createRoot(document.getElementById("root")!).render(<App />);
