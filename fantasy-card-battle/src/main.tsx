import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FantasyCardBattle from "./FantasyCardBattle";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FantasyCardBattle />
  </StrictMode>,
);
