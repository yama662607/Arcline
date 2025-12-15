import { useRef } from 'react';

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

  if (!bridgeRef.current) {
    bridgeRef.current = getServiceWorkerBridge();
  }

  return bridgeRef.current;
}
