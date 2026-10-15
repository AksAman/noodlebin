import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@xyflow/react/dist/style.css"
import "../../../packages/node-view/src/styles.css"
import { PastePage } from "./PastePage"
import "./app.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PastePage />
  </StrictMode>,
)
