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
  coalescedEventsCount?: number;
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
    top: 10px;
    right: 10px;
    width: 900px;
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

  debugWindow.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #00ff00;">
      <div style="font-weight: bold; color: #00ffff; font-size: 13px;">
        🔍 Edge Detection Debug (Phase 1-3)
      </div>
      <div style="font-size: 9px; color: #888;">
        Ctrl+Shift+D: Toggle | Ctrl+Shift+R: Reset | Ctrl+Shift+C: Copy
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
      <!-- Left Column: Position & State -->
      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 11px; margin-bottom: 4px;">📍 Position & State</div>
        <div id="position-info" style="line-height: 1.5;"></div>
      </div>

      <!-- Middle Column: Conditions & Trigger -->
      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 11px; margin-bottom: 4px;">✓ Conditions</div>
        <div id="conditions-info" style="line-height: 1.5;"></div>
        <div id="trigger-status" style="margin-top: 6px;"></div>
      </div>

      <!-- Right Column: Config & History -->
      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 11px; margin-bottom: 4px;">⚙️ Settings</div>
        <div id="config-ui" style="font-size: 9px; line-height: 1.4; margin-bottom: 8px;"></div>
        <div style="font-weight: bold; color: #00ffff; font-size: 11px; margin-bottom: 4px;">📊 Stats & History</div>
        <div id="stats-info" style="font-size: 9px; line-height: 1.4;"></div>
      </div>
    </div>

    <div id="help-info" style="margin-top: 8px; padding: 6px; background: rgba(0, 100, 255, 0.1); border-radius: 4px; border: 1px solid #0088ff; font-size: 9px; line-height: 1.4; color: #88ccff;"></div>
  `;

  document.documentElement.appendChild(debugWindow);
  renderConfigUi();

  // Initialize help info
  const helpContainer = debugWindow.querySelector('#help-info');
  if (helpContainer) {
    helpContainer.innerHTML = renderHelpInfo();
  }
}

function renderConfigUi() {
  if (!debugWindow) return;
  const container = debugWindow.querySelector('#config-ui');
  if (!container) return;

  const makeCompactCheckbox = (key: keyof EdgeDetectionConfig, label: string) => {
    const checked = config[key] as boolean;
    return `
      <label style="display: flex; align-items: center; margin-bottom: 2px; cursor: pointer;">
        <input type="checkbox" ${checked ? 'checked' : ''} data-key="${key}"
               onchange="window.__arclineEdgeConfigUpdate?.('${key}', this.checked)"
               style="margin-right: 4px;">
        <span style="color: ${checked ? '#00ff00' : '#666'};">${label}</span>
      </label>
    `;
  };

  const makeCompactSlider = (
    key: keyof EdgeDetectionConfig,
    label: string,
    min: number,
    max: number,
    step: number
  ) => {
    const val = config[key] as number;
    return `
      <div style="margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
        <span style="color: #666; font-size: 8px; min-width: 40px;">${label}:</span>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${val}"
               data-key="${key}" style="width: 60px;"
               oninput="window.__arclineEdgeConfigUpdate?.('${key}', Number(this.value))">
        <span style="color: #ffff00; font-size: 9px; min-width: 25px;">${val}</span>
      </div>
    `;
  };

  container.innerHTML = `
    ${makeCompactCheckbox('pointerLeaveInferenceEnabled', 'Phase 2')}
    ${makeCompactCheckbox('debugLogging', 'Console Log')}
    ${makeCompactSlider('snapVelocityThreshold', 'VelX', -20, 0, 1)}
    ${makeCompactSlider('windowEdgeThresholdPx', 'Edge', 0, 100, 2)}
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

function renderPositionInfo(info: DebugInfo) {
  const fmt = (v: number | null | string | undefined, hl = false) => {
    const color = hl ? '#ffff00' : '#00ff00';
    return `<span style="color: ${color}; font-weight: bold;">${v === null || v === undefined ? '-' : typeof v === 'number' ? v.toFixed(1) : v}</span>`;
  };

  const HOTZONE = 8;

  return `
    <div style="font-size: 9px; line-height: 1.6;">
      clientX: ${fmt(info.clientX, info.clientX <= HOTZONE)}<br/>
      clientY: ${fmt(info.clientY)}<br/>
      screenX: ${fmt(info.screenX)}<br/>
      winScreenX: ${fmt(info.windowScreenX)}<br/>
      distFromEdge: ${fmt(info.distanceFromWindowEdge, (info.distanceFromWindowEdge ?? 100) <= config.windowEdgeThresholdPx)}<br/>
      velocityX: ${fmt(info.velocityX, (info.velocityX ?? 0) <= config.snapVelocityThreshold)}<br/>
      velocityY: ${fmt(info.velocityY)}<br/>
      state: ${fmt(info.state)}<br/>
      event: ${fmt(info.lastEventType)}<br/>
      coalesced: ${fmt(info.coalescedEventsCount, (info.coalescedEventsCount ?? 0) > 1)}
    </div>
  `;
}

function renderConditionsInfo(info: DebugInfo) {
  const check = (cond: boolean, label: string) =>
    `<div>${cond ? '✅' : '❌'} ${label}</div>`;

  // Phase 2 の実際の判定条件を反映
  const phase2Enabled = config.pointerLeaveInferenceEnabled;
  const isPointerLeave = info.lastEventType === 'pointerleave';
  const fastLeftVel = (info.velocityX ?? 0) <= config.snapVelocityThreshold;
  const slowYVel = Math.abs(info.velocityY ?? 0) <= config.maxVelocityYThreshold;
  const nearWinEdge = (info.distanceFromWindowEdge ?? 100) <= config.windowEdgeThresholdPx;
  const phase2Trigger = phase2Enabled && isPointerLeave && fastLeftVel && slowYVel && nearWinEdge && info.inHotzone;

  return `
    <div style="font-size: 9px; line-height: 1.6;">
      ${check(info.inHotzone, 'In Hotzone (≤8px)')}
      ${check(info.movingLeft, 'Moving Left')}
      ${check(info.startedOutside, 'Started Outside')}
      ${check(isPointerLeave, 'Pointer Leave')}
      ${check(fastLeftVel, `Fast Left Vel (≤${config.snapVelocityThreshold})`)}
      ${check(slowYVel, `Slow Y Vel (≤${config.maxVelocityYThreshold})`)}
      ${check(nearWinEdge, `Near Win Edge (≤${config.windowEdgeThresholdPx})`)}
      ${check((info.coalescedEventsCount ?? 0) > 1, 'Multi-Coalesced')}
      ${phase2Trigger ? '<div style="color: #ffff00; font-weight: bold;">⚡ Phase 2 Ready</div>' : ''}
    </div>
  `;
}

function renderTriggerStatus(info: DebugInfo) {
  return `
    <div style="padding: 6px; background: ${info.shouldTrigger ? 'rgba(0, 255, 0, 0.2)' : 'rgba(100, 100, 100, 0.2)'}; border-radius: 4px; border: 2px solid ${info.shouldTrigger ? '#00ff00' : '#666'}; text-align: center;">
      <span style="font-weight: bold; font-size: 11px;">
        ${info.shouldTrigger ? '🚀 TRIGGER' : '⏸️ NO TRIGGER'}
      </span>
    </div>
  `;
}

function renderStatsInfo() {
  const historyHtml = eventHistory
    .slice()
    .reverse()
    .slice(0, 5)
    .map((e) => {
      const age = Date.now() - e.time;
      const color = e.triggered ? '#00ff00' : '#444';
      return `<div style="color: ${color};">${e.triggered ? '🚀' : '  '} x=${e.x.toFixed(0)} (${age}ms)</div>`;
    })
    .join('');

  return `
    <div style="font-size: 9px; line-height: 1.4;">
      <div>Events: <span style="color: #00ff00; font-weight: bold;">${eventCount}</span></div>
      <div>Triggers: <span style="color: ${triggerCount > 0 ? '#ffff00' : '#00ff00'}; font-weight: bold;">${triggerCount}</span></div>
      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #333;">Recent (5):</div>
      ${historyHtml || '<div style="color: #444;">No events</div>'}
    </div>
  `;
}

function renderHelpInfo() {
  return `
    <div style="line-height: 1.5;">
      <strong style="color: #00ffff;">💡 使い方:</strong>
      カーソルを画面左端に移動してエッジ検知をテスト。
      <strong style="color: #ffff00;">clientX ≤ 8px</strong> でホットゾーン。
      <strong style="color: #ffff00;">coalesced > 1</strong> なら Phase 1 が動作中（高速移動対応）。
      <strong style="color: #ffff00;">Pointer Leave + 条件</strong> なら Phase 2 が動作中（ウィンドウ枠対応）。
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

  // Update position info
  const positionContainer = debugWindow.querySelector('#position-info');
  if (positionContainer) {
    positionContainer.innerHTML = renderPositionInfo(info);
  }

  // Update conditions info
  const conditionsContainer = debugWindow.querySelector('#conditions-info');
  if (conditionsContainer) {
    conditionsContainer.innerHTML = renderConditionsInfo(info);
  }

  // Update trigger status
  const triggerContainer = debugWindow.querySelector('#trigger-status');
  if (triggerContainer) {
    triggerContainer.innerHTML = renderTriggerStatus(info);
  }

  // Update stats info
  const statsContainer = debugWindow.querySelector('#stats-info');
  if (statsContainer) {
    statsContainer.innerHTML = renderStatsInfo();
  }

  // Update help info
  const helpContainer = debugWindow.querySelector('#help-info');
  if (helpContainer) {
    helpContainer.innerHTML = renderHelpInfo();
  }
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
