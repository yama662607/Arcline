import { useEffect, useRef } from 'react';

import { queryClient } from '@/lib/query-client';
import { ServiceWorkerBridge } from '@/lib/service-worker-bridge';

// Global bridge instance
let bridgeInstance: ServiceWorkerBridge | null = null;

export function getServiceWorkerBridge(): ServiceWorkerBridge {
  if (!bridgeInstance) {
    bridgeInstance = new ServiceWorkerBridge(queryClient);
    bridgeInstance.setupQueries();
  }
  return bridgeInstance;
}

// Hook to access the bridge and handle cleanup
export function useServiceWorkerBridge() {
  const bridgeRef = useRef<ServiceWorkerBridge | null>(null);

  useEffect(() => {
    // Get or create bridge instance
    bridgeRef.current = getServiceWorkerBridge();

    // Cleanup on unmount
    return () => {
      // Don't destroy the global instance, just clear reference
      bridgeRef.current = null;
    };
  }, []);

  return bridgeRef.current;
}
