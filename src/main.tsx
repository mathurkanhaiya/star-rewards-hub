import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { PreferencesProvider } from "./context/PreferencesContext";

createRoot(document.getElementById("root")!).render(
  <PreferencesProvider>
    <App />
  </PreferencesProvider>
);
