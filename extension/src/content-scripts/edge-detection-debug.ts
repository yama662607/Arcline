/// <reference types="chrome" />

/**
 * Debug overlay for edge detection
 * Shows real-time cursor position and trigger conditions
 */

import {
  getEdgeDetectionConfig,
  updateEdgeDetectionConfig,
  type EdgeDetectionConfig,
} from './edge-detection-config';

let debugWindow: HTMLDivElement | null = null;
let isEnabled = false;
let eventHistory: Array<{ x: number; time: number; triggered: boolean }> = [];
let eventCount = 0;
let triggerCount = 0;
let config = getEdgeDetectionConfig();

const MAX_HISTORY = 200;

interface DebugInfo {
  clientX: number;
  clientY: number;
  lastX: number | null;
  inHotzone: boolean;
  movingLeft: boolean;
  startedOutside: boolean;
  hotzoneIntersects: boolean;
  shouldTrigger: boolean;
  rafPending: boolean;
  targetTag: string | null;
  targetId: string | null;
  targetClass: string | null;
  screenX?: number;
  windowScreenX?: number;
  distanceFromWindowEdge?: number;
  velocityX?: number;
  velocityY?: number;
  state?: string;
  lastEventType?: string;
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
    width: 420px;
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
    pointer-events: auto;
    user-select: none;
  `;

  debugWindow.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; color: #00ffff; font-size: 14px;">
      🔍 Edge Detection Debug
    </div>
    <div id="debug-content" style="line-height: 1.6;"></div>
    <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 4px; border: 1px solid #00ff00;">
      <div style="font-weight: bold; margin-bottom: 6px; color: #00ffff;">⚙️ Thresholds</div>
      <div id="config-ui" style="font-size: 10px; line-height: 1.8;"></div>
    </div>
  `;

  document.documentElement.appendChild(debugWindow);
  renderConfigUi();
}

function renderConfigUi() {
  if (!debugWindow) return;
  const container = debugWindow.querySelector('#config-ui');
  if (!container) return;

  const makeSlider = (
    key: keyof EdgeDetectionConfig,
    label: string,
    min: number,
    max: number,
    step: number
  ) => {
    const val = config[key] as number;
    return `
      <div style="margin-bottom: 4px;">
        <span style="color: #888;">${label}:</span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${val}"
               data-key="${key}" style="width: 120px; margin-left: 8px; vertical-align: middle;"
               oninput="window.__arclineEdgeConfigUpdate?.('${key}', Number(this.value))">
        <span style="color: #ffff00; margin-left: 6px; font-weight: bold;">${val}</span>
      </div>
    `;
  };

  const makeCheckbox = (key: keyof EdgeDetectionConfig, label: string) => {
    const checked = config[key] as boolean;
    return `
      <div style="margin-bottom: 4px;">
        <input type="checkbox" ${checked ? 'checked' : ''} data-key="${key}"
               onchange="window.__arclineEdgeConfigUpdate?.('${key}', this.checked)"
               style="margin-right: 6px; vertical-align: middle;">
        <span style="color: #888;">${label}</span>
      </div>
    `;
  };

  container.innerHTML = `
    ${makeCheckbox('pointerLeaveInferenceEnabled', 'Enable pointerleave inference')}
    ${makeSlider('snapVelocityThreshold', 'Snap velocity threshold (px)', -20, 0, 1)}
    ${makeSlider('maxVelocityYThreshold', 'Max Y velocity threshold (px)', 0, 30, 1)}
    ${makeSlider('viewportEdgeThresholdPx', 'Viewport edge threshold (px)', 0, 200, 4)}
    ${makeSlider('windowEdgeThresholdPx', 'Window edge threshold (px)', 0, 100, 2)}
    ${makeSlider('inferenceCooldownMs', 'Inference cooldown (ms)', 0, 1000, 50)}
    ${makeCheckbox('debugLogging', 'Debug logging')}
  `;
}

(window as any).__arclineEdgeConfigUpdate = (
  key: keyof EdgeDetectionConfig,
  value: boolean | number
) => {
  updateEdgeDetectionConfig({ [key]: value });
  config = getEdgeDetectionConfig();
  renderConfigUi();
};

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

function generatePositionHtml(
  info: DebugInfo,
  formatValue: (v: number | null | boolean | string, highlight?: boolean) => string
) {
  return `
    <div style="margin-bottom: 8px;">
      <span style="color: #888;">Current Position:</span><br/>
      clientX: ${formatValue(info.clientX, Math.abs(info.clientX) <= 8)}
      <br/>
      clientY: ${formatValue(info.clientY)}
      <br/>
      screenX: ${formatValue(info.screenX ?? null)}
      <br/>
      windowScreenX: ${formatValue(info.windowScreenX ?? null)}
      <br/>
      distanceFromWindowEdge: ${formatValue(info.distanceFromWindowEdge ?? null)}
      <br/>
      velocityX: ${formatValue(info.velocityX ?? null)}
      <br/>
      velocityY: ${formatValue(info.velocityY ?? null)}
      <br/>
      state: ${formatValue(info.state ?? null)}
      <br/>
      lastEventType: ${formatValue(info.lastEventType ?? null)}
    </div>
  `;
}

function generateTargetHtml(
  info: DebugInfo,
  formatValue: (v: number | null | boolean | string, highlight?: boolean) => string
) {
  return `
    <div style="margin-bottom: 8px;">
      <span style="color: #888;">Hover Target:</span><br/>
      tag: ${formatValue(info.targetTag, false)}
      <br/>
      id: ${formatValue(info.targetId, false)}
      <br/>
      class: ${formatValue(info.targetClass, false)}
    </div>
  `;
}

function generateConditionsHtml(info: DebugInfo) {
  return `
    <div style="margin-bottom: 8px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;">
      <span style="color: #888;">Conditions:</span><br/>
      <div style="margin-top: 4px;">
        ${info.inHotzone ? '✅' : '❌'} In Hotzone (-1 ≤ x ≤ 8)<br/>
        ${info.movingLeft ? '✅' : '❌'} Moving Left<br/>
        ${info.startedOutside ? '✅' : '❌'} Started Outside (x > 8)<br/>
        ${info.hotzoneIntersects ? '✅' : '❌'} Trajectory Intersects<br/>
        ${info.lastEventType === 'pointerleave' ? '🚪' : '  '} Pointer Leave Event<br/>
        ${typeof info.velocityX === 'number' && info.velocityX <= -6 ? '⚡' : '  '} Fast Left Velocity (≤ -6px)<br/>
        ${typeof info.velocityY === 'number' && Math.abs(info.velocityY) <= 8 ? '↕️' : '  '} Slow Y Velocity (|Y| ≤ 8px)<br/>
        ${typeof info.distanceFromWindowEdge === 'number' && info.distanceFromWindowEdge <= 24 ? '📍' : '  '} Near Window Edge (≤ 24px)
      </div>
    </div>
  `;
}

function generateTriggerHtml(info: DebugInfo) {
  return `
    <div style="padding: 8px; background: ${info.shouldTrigger ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)'}; border-radius: 4px; border: 2px solid ${info.shouldTrigger ? '#00ff00' : '#ff0000'};">
      <span style="font-weight: bold; font-size: 13px;">
        ${info.shouldTrigger ? '🚀 SHOULD TRIGGER' : '⏸️  NO TRIGGER'}
      </span>
    </div>
  `;
}

export function updateDebugInfo(info: DebugInfo) {
  if (!isEnabled || !debugWindow) return;

  eventCount++;
  if (info.shouldTrigger) {
    triggerCount++;
  }

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

  const formatValue = (value: number | null | boolean | string, highlight = false) => {
    const color = highlight ? '#ffff00' : '#00ff00';
    return `<span style="color: ${color}; font-weight: bold;">${value === null ? 'null' : typeof value === 'number' ? value.toFixed(2) : value}</span>`;
  };

  const historyHtml = eventHistory
    .slice()
    .reverse()
    .slice(0, 10)
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

    ${generatePositionHtml(info, formatValue)}

    ${generateTargetHtml(info, formatValue)}

    <div style="margin-bottom: 8px;">
      <span style="color: #888;">Previous Position:</span><br/>
      lastX: ${formatValue(info.lastX)}
    </div>

    ${generateConditionsHtml(info)}

    ${generateTriggerHtml(info)}

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
