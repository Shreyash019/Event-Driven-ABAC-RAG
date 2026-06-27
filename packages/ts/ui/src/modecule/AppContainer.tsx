import type { ReactNode, CSSProperties } from "react";

export interface AppContainerProps {
  children: ReactNode;
  maxWidth?: number;       
}

const base: CSSProperties = {
  margin: "0 auto",
  fontFamily: "system-ui, sans-serif",
};

export function AppContainer({ children, maxWidth = 4440 }: AppContainerProps) {
  return (
    <main style={{ ...base, maxWidth }}>
      {children}
    </main>
  );
}