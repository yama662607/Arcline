import type React from 'react';
import { createContext, useContext } from 'react';

/**
 * Context to provide a portal container element.
 * Useful for Radix UI components when running inside a Shadow DOM.
 */
interface PortalContextType {
  container: HTMLDivElement | null;
}

const PortalContext = createContext<PortalContextType>({
  container: null,
});

export function PortalProvider({
  children,
  container,
}: {
  children: React.ReactNode;
  container: HTMLDivElement | null;
}) {
  return <PortalContext.Provider value={{ container }}>{children}</PortalContext.Provider>;
}

export function usePortalContainer() {
  const context = useContext(PortalContext);
  return context.container;
}
