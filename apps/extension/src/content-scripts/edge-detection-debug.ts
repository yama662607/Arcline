/// <reference types="chrome" />

/**
 * Debug overlay for edge detection
 * Shows real-time cursor position and trigger conditions
 */

let debugWindow: HTMLDivElement | null = null;
let isEnabled = false;
let eventHistory: Array<{ x: number; time: number; triggered: boolean }> = [];
let eventCount = 0;
let triggerCount = 0;

const MAX_HISTORY = 200;

interface DebugInfo {
  clientX: number;
  lastX: number | null;
  inHotzone: boolean;
  movingLeft: boolean;
  startedOutside: boolean;
  hotzoneIntersects: boolean;
  shouldTrigger: boolean;
  rafPending: boolean;
}

export function enableEdgeDetectionDebug() {
  if (debugWindow) return;
  isEnabled = true;
  eventHistory = [];
  eventCount = 0;
  triggerCount = 0;

  debugWindow = document.createElement('div');
  debugWindow.id = 'arcline-edge-debug';
  debugWindow.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    max-height: 80vh;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.95);
    color: #00ff00;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 11px;
    padding: 15px;
    border-radius: 8px;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
    border: 2px solid #00ff00;
    pointer-events: none;
    user-select: none;
  `;

  debugWindow.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; color: #00ffff; font-size: 14px;">
      🔍 Edge Detection Debug
    </div>
    <div id="debug-content" style="line-height: 1.6;"></div>
  `;

  document.documentElement.appendChild(debugWindow);
}

export function disableEdgeDetectionDebug() {
  if (debugWindow) {
    debugWindow.remove();
    debugWindow = null;
  }
  isEnabled = false;
  eventHistory = [];
  eventCount = 0;
  triggerCount = 0;
}

function copyToClipboard() {
  const summary = `
=== Arcline Edge Detection Debug Report ===
Total Events: ${eventCount}
Total Triggers: ${triggerCount}
History Size: ${eventHistory.length}

Event History (last ${Math.min(eventHistory.length, MAX_HISTORY)}):
${eventHistory
  .slice()
  .reverse()
  .map((e, i) => {
    const age = Date.now() - e.time;
    return `${i + 1}. x=${e.x.toFixed(2)} | ${e.triggered ? 'TRIGGERED' : 'no trigger'} | ${age}ms ago`;
  })
  .join('\n')}

Generated at: ${new Date().toISOString()}
`;

  // Always log to console
  console.log(summary);
  console.log('[Arcline Debug] Debug info logged to console (see above)');

  // Try to copy to clipboard
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(summary)
      .then(() => {
        console.log('[Arcline Debug] Debug info also copied to clipboard');
        showNotification('✓ Copied to clipboard & console!', true);
      })
      .catch((err) => {
        console.error('[Arcline Debug] Failed to copy to clipboard:', err);
        showNotification('✓ Logged to console (clipboard failed)', false);
      });
  } else {
    showNotification('✓ Logged to console', false);
  }
}

function showNotification(message: string, success: boolean) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${success ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 165, 0, 0.9)'};
    color: black;
    padding: 20px 40px;
    border-radius: 8px;
    font-family: 'Monaco', monospace;
    font-size: 14px;
    font-weight: bold;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0, 255, 0, 0.5);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

export function updateDebugInfo(info: DebugInfo) {
  if (!isEnabled || !debugWindow) return;

  eventCount++;
  if (info.shouldTrigger) {
    triggerCount++;
  }

  // Track event history (keep last MAX_HISTORY)
  eventHistory.push({
    x: info.clientX,
    time: Date.now(),
    triggered: info.shouldTrigger,
  });
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.shift();
  }

  const content = debugWindow.querySelector('#debug-content');
  if (!content) return;

  const formatValue = (value: number | null | boolean, highlight = false) => {
    const color = highlight ? '#ffff00' : '#00ff00';
    return `<span style="color: ${color}; font-weight: bold;">${value === null ? 'null' : typeof value === 'number' ? value.toFixed(2) : value}</span>`;
  };

  const historyHtml = eventHistory
    .slice()
    .reverse()
    .slice(0, 10) // Show only last 10 in UI
    .map((e) => {
      const age = Date.now() - e.time;
      const color = e.triggered ? '#00ff00' : '#666';
      return `<div style="color: ${color}; font-size: 10px;">
        ${e.triggered ? '🚀' : '  '} x=${e.x.toFixed(1)} (${age}ms ago)
      </div>`;
    })
    .join('');

  content.innerHTML = `
    <div style="margin-bottom: 8px; padding: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
      <span style="color: #888;">Statistics:</span><br/>
      Events: ${formatValue(eventCount)} | Triggers: ${formatValue(triggerCount, triggerCount > 0)}<br/>
      <span style="font-size: 10px; color: #666;">History: ${eventHistory.length}/${MAX_HISTORY}</span>
    </div>

    <div style="margin-bottom: 8px;">
      <span style="color: #888;">Current Position:</span><br/>
      clientX: ${formatValue(info.clientX, Math.abs(info.clientX) <= 8)}
    </div>

    <div style="margin-bottom: 8px;">
      <span style="color: #888;">Previous Position:</span><br/>
      lastX: ${formatValue(info.lastX)}
    </div>

    <div style="margin-bottom: 8px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
      <span style="color: #888;">Conditions:</span><br/>
      <div style="margin-top: 4px;">
        ${info.inHotzone ? '✅' : '❌'} In Hotzone (-1 ≤ x ≤ 8)<br/>
        ${info.movingLeft ? '✅' : '❌'} Moving Left<br/>
        ${info.startedOutside ? '✅' : '❌'} Started Outside (x > 8)<br/>
        ${info.hotzoneIntersects ? '✅' : '❌'} Trajectory Intersects
      </div>
    </div>

    <div style="padding: 8px; background: ${info.shouldTrigger ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)'}; border-radius: 4px; border: 2px solid ${info.shouldTrigger ? '#00ff00' : '#ff0000'};">
      <span style="font-weight: bold; font-size: 13px;">
        ${info.shouldTrigger ? '🚀 SHOULD TRIGGER' : '⏸️  NO TRIGGER'}
      </span>
    </div>

    <div style="margin-top: 10px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
      <span style="color: #888;">Event History (last 10 of ${eventHistory.length}):</span><br/>
      <div style="margin-top: 4px; font-family: monospace;">
        ${historyHtml || '<span style="color: #666;">No events yet</span>'}
      </div>
    </div>

    <div style="margin-top: 10px; font-size: 10px; color: #666; line-height: 1.4;">
      <strong>Shortcuts:</strong><br/>
      Ctrl+Shift+D: Toggle<br/>
      Ctrl+Shift+R: Reset<br/>
      Ctrl+Shift+C: Copy (logs to console)
    </div>
  `;
}

// Toggle debug with keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    if (isEnabled) {
      disableEdgeDetectionDebug();
      console.log('[Arcline Debug] Edge detection debug disabled');
    } else {
      enableEdgeDetectionDebug();
      console.log('[Arcline Debug] Edge detection debug enabled');
    }
  }

  // Reset statistics
  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    eventCount = 0;
    triggerCount = 0;
    eventHistory = [];
    console.log('[Arcline Debug] Statistics reset');
  }

  // Copy to clipboard
  if (e.ctrlKey && e.shiftKey && e.key === 'C') {
    if (isEnabled) {
      copyToClipboard();
    }
  }
});
