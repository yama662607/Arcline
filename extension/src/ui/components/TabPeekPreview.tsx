import { AnimatePresence, motion } from 'framer-motion';

import type { TabEntry } from '@/shared/types';
import { safeHostname } from './TabRow';

interface TabPeekPreviewProps {
  tab: TabEntry;
  isVisible: boolean;
  position?: { top: number; left: number };
}

export function TabPeekPreview({ tab, isVisible, position }: TabPeekPreviewProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, x: 10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: position?.top ?? 0,
            left: position?.left ?? 0,
          }}
        >
          <div className="bg-slate-800/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl p-3 min-w-[240px] max-w-[320px]">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-white leading-snug break-words line-clamp-2">
                {tab.title}
              </div>
              <div className="text-xs text-slate-400 font-mono truncate">
                {tab.url || 'about:blank'}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {tab.favIconUrl && (
                  <img src={tab.favIconUrl} alt="" className="w-3 h-3 rounded-sm opacity-70" />
                )}
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  {safeHostname(tab.url || '')}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
