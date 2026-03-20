import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

createRoot(document.getElementById("root")!).render(
  <TonConnectUIProvider manifestUrl="https://star-rewards-hub.vercel.app/tonconnect-manifest.json">
    <App />
  </TonConnectUIProvider>
);