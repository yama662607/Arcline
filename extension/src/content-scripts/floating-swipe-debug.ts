type SwipeDebugInfo = {
  deltaX: number;
  deltaY: number;
  prevented: boolean;
  reason: string;
  scrollable: boolean;
  scrollLeft: number;
  currentDelta: number;
  processingTime?: number;
  isInsideFloatingUI?: boolean;
  pathLength?: number;
  targetInfo?: string;
};

let swipeDebugEnabled = false;
let swipeDebugWindow: HTMLDivElement | null = null;
let swipeEventHistory: Array<{
  time: number;
  deltaX: number;
  deltaY: number;
  prevented: boolean;
  reason: string;
  scrollable: boolean;
  scrollLeft: number;
  currentDelta: number;
  processingTime: number;
  isInsideFloatingUI?: boolean;
  pathLength?: number;
  targetInfo?: string;
}> = [];
let swipeEventCount = 0;
let swipePreventCount = 0;
let logStartTime = Date.now();

function recordSwipeEvent(info: SwipeDebugInfo) {
  swipeEventCount++;
  if (info.prevented) {
    swipePreventCount++;
  }

  swipeEventHistory.push({
    time: Date.now(),
    deltaX: info.deltaX,
    deltaY: info.deltaY,
    prevented: info.prevented,
    reason: info.reason,
    scrollable: info.scrollable,
    scrollLeft: info.scrollLeft,
    currentDelta: info.currentDelta,
    processingTime: info.processingTime ?? 0,
    isInsideFloatingUI: info.isInsideFloatingUI,
    pathLength: info.pathLength,
    targetInfo: info.targetInfo,
  });

  if (swipeEventHistory.length > 1000) {
    swipeEventHistory.shift();
  }
}

function updateSwipeLocationBadge(info: SwipeDebugInfo) {
  if (!swipeDebugWindow) return;
  const locationBadge = swipeDebugWindow.querySelector('#swipe-location-badge');
  if (!locationBadge) return;

  const isOpen = info.reason !== 'floating-ui-closed';
  const badgeText = isOpen ? '✅ FLOATING UI OPEN' : '❌ FLOATING UI CLOSED';
  const badgeBg = isOpen ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
  const badgeBorder = isOpen ? '#00ff00' : '#ff0000';
  const badgeColor = isOpen ? '#00ff00' : '#ff0000';

  locationBadge.innerHTML = badgeText;
  (locationBadge as HTMLElement).style.background = badgeBg;
  (locationBadge as HTMLElement).style.border = `2px solid ${badgeBorder}`;
  (locationBadge as HTMLElement).style.color = badgeColor;
}

function countPreventedEvents(): number {
  let count = 0;
  for (const event of swipeEventHistory) {
    if (event.prevented) count += 1;
  }
  return count;
}

function updatePreventRate(preventedCount: number) {
  if (!swipeDebugWindow) return;
  const preventRateBar = swipeDebugWindow.querySelector('#prevent-rate-bar');
  const preventRateValue = swipeDebugWindow.querySelector('#prevent-rate-value');
  if (!preventRateBar || !preventRateValue) return;

  const preventRate =
    swipeEventHistory.length > 0 ? (preventedCount / swipeEventHistory.length) * 100 : 0;
  const barWidth = `${preventRate}%`;
  let barColor = '#00ff00';
  if (preventRate > 70) {
    barColor = '#ff0000';
  } else if (preventRate > 30) {
    barColor = '#ffff00';
  }

  (preventRateBar as HTMLElement).style.width = barWidth;
  (preventRateBar as HTMLElement).style.backgroundColor = barColor;
  preventRateValue.innerHTML = `<span style="color: ${barColor};">${preventRate.toFixed(0)}%</span>`;
}

function updateSwipeCurrentInfo(info: SwipeDebugInfo) {
  if (!swipeDebugWindow) return;
  const currentContainer = swipeDebugWindow.querySelector('#swipe-current-info');
  if (!currentContainer) return;

  currentContainer.innerHTML = `
      <div><strong>deltaX:</strong> <span style="color: ${Math.abs(info.deltaX) > Math.abs(info.deltaY) ? '#ffff00' : '#00ff00'}; font-size: 13px;">${info.deltaX.toFixed(1)}</span></div>
      <div><strong>deltaY:</strong> <span style="color: ${Math.abs(info.deltaY) > Math.abs(info.deltaX) ? '#ffff00' : '#00ff00'}; font-size: 13px;">${info.deltaY.toFixed(1)}</span></div>
      <div><strong>accumulated:</strong> <span style="color: #00ff00; font-size: 13px;">${info.currentDelta.toFixed(1)}</span></div>
      <div><strong>prevented:</strong> <span style="color: ${info.prevented ? '#ff0000' : '#00ff00'}; font-size: 13px; font-weight: bold;">${info.prevented ? 'YES' : 'NO'}</span></div>
      <div><strong>reason:</strong> <span style="color: #ffff00; font-size: 12px;">${info.reason}</span></div>
      ${info.processingTime ? `<div><strong>time:</strong> <span style="color: ${info.processingTime > 5 ? '#ff0000' : '#00ff00'}; font-size: 13px;">${info.processingTime.toFixed(2)}ms</span></div>` : ''}
      <div style="border-top: 1px solid rgba(255,255,255,0.2); margin-top: 4px; padding-top: 4px;">
        <div><strong>isInsideUI:</strong> <span style="color: ${info.isInsideFloatingUI ? '#00ff00' : '#ff0000'}; font-size: 13px; font-weight: bold;">${info.isInsideFloatingUI ? 'YES ✅' : 'NO ❌'}</span></div>
        ${info.pathLength ? `<div><strong>pathLength:</strong> <span style="color: #00ffff; font-size: 12px;">${info.pathLength}</span></div>` : ''}
        ${info.targetInfo ? `<div><strong>target:</strong> <span style="color: #ffff00; font-size: 11px;">${info.targetInfo}</span></div>` : ''}
      </div>
    `;
}

function updateSwipePageInfo(info: SwipeDebugInfo) {
  if (!swipeDebugWindow) return;
  const pageContainer = swipeDebugWindow.querySelector('#swipe-page-info');
  if (!pageContainer) return;

  pageContainer.innerHTML = `
      <div><strong>scrollable:</strong> <span style="color: ${info.scrollable ? '#ffff00' : '#00ff00'}; font-size: 13px;">${info.scrollable ? 'YES' : 'NO'}</span></div>
      <div><strong>scrollLeft:</strong> <span style="color: #00ff00; font-size: 13px;">${info.scrollLeft.toFixed(0)}</span></div>
      <div><strong>scrollWidth:</strong> <span style="color: #00ff00; font-size: 13px;">${document.documentElement.scrollWidth}</span></div>
      <div><strong>clientWidth:</strong> <span style="color: #00ff00; font-size: 13px;">${document.documentElement.clientWidth}</span></div>
    `;
}

function updateSwipeStatsInfo(preventedCount: number) {
  if (!swipeDebugWindow) return;
  const statsContainer = swipeDebugWindow.querySelector('#swipe-stats-info');
  if (!statsContainer) return;

  const now = Date.now();
  const recentEvents = swipeEventHistory.filter((e) => now - e.time < 1000);
  const eventsPerSec = recentEvents.length;

  statsContainer.innerHTML = `
      <div><strong>total events:</strong> <span style="color: #00ff00; font-size: 13px;">${swipeEventCount}</span></div>
      <div><strong>events/sec:</strong> <span style="color: ${eventsPerSec > 60 ? '#ff0000' : '#00ff00'}; font-size: 13px;">${eventsPerSec}</span></div>
      <div><strong>prevented:</strong> <span style="color: #ffff00; font-size: 13px;">${preventedCount}</span></div>
    `;
}

function updateSwipeHistoryInfo() {
  if (!swipeDebugWindow) return;
  const historyContainer = swipeDebugWindow.querySelector('#swipe-history-info');
  if (!historyContainer) return;

  const historyHtml = swipeEventHistory
    .slice()
    .reverse()
    .slice(0, 10)
    .map((event, index) => {
      const age = Date.now() - event.time;
      const color = event.prevented ? '#ff0000' : '#00ff00';
      const icon = event.prevented ? '🚫' : '✅';
      return `<div style="color: ${color};"><strong>${index + 1}.</strong> ${icon} dx=${event.deltaX.toFixed(0)} dy=${event.deltaY.toFixed(0)} | <span style="color: #ffff00;">${event.reason}</span> | ${age}ms ago</div>`;
    })
    .join('');

  historyContainer.innerHTML = historyHtml || '<div style="color: #444;">No events</div>';
}

export function updateSwipeDebugInfo(info: SwipeDebugInfo) {
  if (!swipeDebugEnabled || !swipeDebugWindow) return;

  recordSwipeEvent(info);
  updateSwipeLocationBadge(info);

  const preventedCount = countPreventedEvents();
  updatePreventRate(preventedCount);
  updateSwipeCurrentInfo(info);
  updateSwipePageInfo(info);
  updateSwipeStatsInfo(preventedCount);
  updateSwipeHistoryInfo();
}

export function enableSwipeDebug() {
  if (swipeDebugWindow) return;
  swipeDebugEnabled = true;
  swipeEventHistory = [];
  swipeEventCount = 0;
  swipePreventCount = 0;
  logStartTime = Date.now();

  swipeDebugWindow = document.createElement('div');
  swipeDebugWindow.id = 'arcline-swipe-debug';
  swipeDebugWindow.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    width: 800px;
    background: rgba(0, 0, 0, 0.95);
    color: #00ff00;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 10px;
    padding: 12px;
    border-radius: 8px;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
    border: 2px solid #00ff00;
    pointer-events: auto;
    user-select: none;
  `;

  swipeDebugWindow.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #00ff00;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-weight: bold; color: #00ffff; font-size: 16px;">
          🔍 Swipe Gesture Debug
        </div>
        <div id="swipe-location-badge" style="padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 13px;"></div>
      </div>
      <div style="font-size: 11px; color: #888; line-height: 1.6;">
        <div>Ctrl+Shift+S: Toggle | Ctrl+Shift+R: Reset</div>
        <div>Ctrl+Shift+E: Copy JSON | Ctrl+Shift+W: Save to File</div>
        <div>Ctrl+Shift+L: Print to Console</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 12px; margin-bottom: 6px;">📊 Current Event</div>
        <div id="swipe-current-info" style="line-height: 1.6;"></div>
      </div>

      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 12px; margin-bottom: 6px;">📈 Page Status</div>
        <div id="swipe-page-info" style="line-height: 1.6;"></div>
      </div>
    </div>

    <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 12px; margin-bottom: 6px;">📊 Statistics</div>
        <div id="swipe-stats-info" style="line-height: 1.6;"></div>
        <div style="margin-top: 8px;">
          <div style="font-size: 10px; margin-bottom: 4px;">Prevent Rate</div>
          <div style="background: rgba(255, 255, 255, 0.1); height: 8px; border-radius: 4px; overflow: hidden;">
            <div id="prevent-rate-bar" style="height: 100%; width: 0%; transition: width 0.3s;"></div>
          </div>
          <div id="prevent-rate-value" style="font-size: 11px; margin-top: 4px;"></div>
        </div>
      </div>

      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 12px; margin-bottom: 6px;">🕒 Recent History</div>
        <div id="swipe-history-info" style="line-height: 1.4; font-size: 9px;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(swipeDebugWindow);
}

export function disableSwipeDebug() {
  if (swipeDebugWindow) {
    swipeDebugWindow.remove();
    swipeDebugWindow = null;
  }
  swipeDebugEnabled = false;
  swipeEventHistory = [];
  swipeEventCount = 0;
  swipePreventCount = 0;
}

export function resetSwipeDebugStats() {
  swipeEventHistory = [];
  swipeEventCount = 0;
  swipePreventCount = 0;
  logStartTime = Date.now();
}

export function isSwipeDebugActive(): boolean {
  return swipeDebugEnabled;
}

export function exportSwipeLogsToClipboard() {
  if (swipeEventHistory.length === 0) {
    console.warn('[Arcline Debug] No swipe events to export');
    return;
  }

  const now = Date.now();
  const firstEventTime = swipeEventHistory[0]?.time ?? now;
  const sessionDuration = now - logStartTime;

  const preventRate = swipeEventCount > 0 ? (swipePreventCount / swipeEventCount) * 100 : 0;
  const eventsPerSecond =
    sessionDuration > 0 ? (swipeEventCount / (sessionDuration / 1000)).toFixed(2) : '0';

  const reasonCounts: Record<string, number> = {};
  for (const event of swipeEventHistory) {
    reasonCounts[event.reason] = (reasonCounts[event.reason] ?? 0) + 1;
  }

  const exportData = {
    metadata: {
      timestamp: new Date().toISOString(),
      exportedAt: new Date().toLocaleString('ja-JP'),
      sessionDuration: `${(sessionDuration / 1000).toFixed(1)}s`,
      totalEvents: swipeEventCount,
      preventedEvents: swipePreventCount,
      preventRate: `${preventRate.toFixed(1)}%`,
    },
    summary: {
      totalEvents: swipeEventCount,
      preventedEvents: swipePreventCount,
      preventRate: `${preventRate.toFixed(1)}%`,
      sessionDuration: `${(sessionDuration / 1000).toFixed(1)}s`,
      eventsPerSecond,
      capturedEvents: swipeEventHistory.length,
      reasonBreakdown: reasonCounts,
    },
    events: swipeEventHistory.map((event, index) => ({
      index,
      relativeTime: `${((event.time - firstEventTime) / 1000).toFixed(3)}s`,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      prevented: event.prevented,
      reason: event.reason,
      scrollable: event.scrollable,
      scrollLeft: event.scrollLeft,
      currentDelta: event.currentDelta,
      processingTime: `${event.processingTime.toFixed(2)}ms`,
      isInsideFloatingUI: event.isInsideFloatingUI,
      pathLength: event.pathLength,
      targetInfo: event.targetInfo,
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  navigator.clipboard
    .writeText(jsonString)
    .then(() => {
      console.log('[Arcline Debug] ✅ Logs exported to clipboard!');
      console.log(
        `Total events: ${swipeEventCount}, Prevented: ${swipePreventCount}, Prevent rate: ${preventRate.toFixed(1)}%`
      );
    })
    .catch((err) => {
      console.error('[Arcline Debug] ❌ Failed to copy to clipboard:', err);
      console.log('[Arcline Debug] Log data:', exportData);
    });
}

export function printSwipeLogsToConsole() {
  if (swipeEventHistory.length === 0) {
    console.warn('[Arcline Debug] No swipe events to print');
    return;
  }

  const now = Date.now();
  const firstEventTime = swipeEventHistory[0]?.time ?? now;
  const sessionDuration = now - logStartTime;
  const preventRate = swipeEventCount > 0 ? (swipePreventCount / swipeEventCount) * 100 : 0;

  console.log('[Arcline Debug] 📊 Swipe Event Logs');
  console.log(`Total events: ${swipeEventCount}`);
  console.log(`Prevented events: ${swipePreventCount}`);
  console.log(`Prevent rate: ${preventRate.toFixed(1)}%`);
  console.log(`Session duration: ${(sessionDuration / 1000).toFixed(1)}s`);
  console.log(`Events in history: ${swipeEventHistory.length}`);
  console.log('---');

  const rows = swipeEventHistory.map((event, index) => {
    const time = ((event.time - firstEventTime) / 1000).toFixed(3);
    return [
      `#${index}`,
      `t=${time}s`,
      `dx=${event.deltaX.toFixed(1)}`,
      `dy=${event.deltaY.toFixed(1)}`,
      `prevented=${event.prevented ? '🚫' : '✅'}`,
      `reason=${event.reason}`,
      `acc=${event.currentDelta.toFixed(1)}`,
      `proc=${event.processingTime.toFixed(2)}ms`,
    ].join(' | ');
  });

  for (const row of rows) {
    console.log(row);
  }
}

export function exportSwipeLogsToFile() {
  if (swipeEventHistory.length === 0) {
    console.warn('[Arcline Debug] No swipe events to export');
    return;
  }

  const now = Date.now();
  const firstEventTime = swipeEventHistory[0]?.time ?? now;
  const sessionDuration = now - logStartTime;

  const preventRate = swipeEventCount > 0 ? (swipePreventCount / swipeEventCount) * 100 : 0;
  const eventsPerSecond =
    sessionDuration > 0 ? (swipeEventCount / (sessionDuration / 1000)).toFixed(2) : '0';

  const reasonCounts: Record<string, number> = {};
  for (const event of swipeEventHistory) {
    reasonCounts[event.reason] = (reasonCounts[event.reason] ?? 0) + 1;
  }

  const exportData = {
    metadata: {
      timestamp: new Date().toISOString(),
      exportedAt: new Date().toLocaleString('ja-JP'),
      sessionDuration: `${(sessionDuration / 1000).toFixed(1)}s`,
      totalEvents: swipeEventCount,
      preventedEvents: swipePreventCount,
      preventRate: `${preventRate.toFixed(1)}%`,
    },
    summary: {
      totalEvents: swipeEventCount,
      preventedEvents: swipePreventCount,
      preventRate: `${preventRate.toFixed(1)}%`,
      sessionDuration: `${(sessionDuration / 1000).toFixed(1)}s`,
      eventsPerSecond,
      capturedEvents: swipeEventHistory.length,
      reasonBreakdown: reasonCounts,
    },
    events: swipeEventHistory.map((event, index) => ({
      index,
      relativeTime: `${((event.time - firstEventTime) / 1000).toFixed(3)}s`,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      prevented: event.prevented,
      reason: event.reason,
      scrollable: event.scrollable,
      scrollLeft: event.scrollLeft,
      currentDelta: event.currentDelta,
      processingTime: `${event.processingTime.toFixed(2)}ms`,
      isInsideFloatingUI: event.isInsideFloatingUI,
      pathLength: event.pathLength,
      targetInfo: event.targetInfo,
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  const date = new Date();
  const dateStr = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
  const filename = `${dateStr}-${timeStr}-swipe-events.json`;

  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('[Arcline Debug] ✅ Logs exported to file!');
  console.log(`Filename: ${filename}`);
  console.log(
    `Total events: ${swipeEventCount}, Prevented: ${swipePreventCount}, Prevent rate: ${preventRate.toFixed(1)}%`
  );
  console.log('💡 Move the downloaded file to docs/logs/ directory');
}
