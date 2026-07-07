import { createPortal } from "react-dom";

type Props = { 
  children: React.ReactNode; 
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left" 
};

// HARD DISABLE - remove HUD badges per GPT instructions
export const HUD_ENABLED = false;

export default function StatusHUD({ children, position = "top-right" }: Props) {
  if (!HUD_ENABLED) return null;
  
  const root = typeof document !== "undefined" ? document.body : null;
  if (!root) return null;

  const pos = {
    "top-right": "top: env(safe-area-inset-top, 12px); right: env(safe-area-inset-right, 12px);",
    "bottom-right": "bottom: env(safe-area-inset-bottom, 12px); right: env(safe-area-inset-right, 12px);",
    "top-left": "top: env(safe-area-inset-top, 12px); left: env(safe-area-inset-left, 12px);",
    "bottom-left": "bottom: env(safe-area-inset-bottom, 12px); left: env(safe-area-inset-left, 12px);",
  }[position];

  return createPortal(
    <div
      id="nn-status-stack"
      style={{
        position: "fixed",
        zIndex: 2147483000, // above everything, but below native UI
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        // position string injected
        ...(Object.fromEntries(pos.split(";").filter(Boolean).map(s=>{
          const [k,v]=s.split(":").map(t=>t.trim()); return [k as any, v];
        })) as any),
      }}
    >
      <div style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
        {children}
      </div>
    </div>,
    root
  );
}