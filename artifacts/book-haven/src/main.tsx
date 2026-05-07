import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When VITE_API_URL is set at build time (e.g. on GitHub Pages where the
// frontend is served from a different origin than the API), prefix every
// generated API request with it. In Replit dev/prod, leave it unset so the
// reverse proxy keeps requests same-origin.
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl && apiUrl.trim() !== "") {
  setBaseUrl(apiUrl.trim());
}

createRoot(document.getElementById("root")!).render(<App />);
