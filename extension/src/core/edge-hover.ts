export interface EdgeHoverConfig {
  enabled: boolean;
  triggerWidthPx: number;
  openDelayMs: number;
  closeDelayMs: number;
  panelWidthPx: number;
}

export interface EdgeHoverCallbacks {
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Pure deterministic state machine for left-edge hover sidebar triggering.
 * Handles:
 * - Dwell delay (prevents accidental graze openings)
 * - Leave grace delay (prevents flickering when moving cursor near panel border)
 * - Active drag suppression (`buttons !== 0` on page never triggers or re-arms until exit)
 * - Stationary pointer packets during dwell (never cancels pending open)
 * - Lock state (open menu / modal / inline rename / DnD prevents auto-close)
 * - Outside pointerdown immediate dismissal
 */
export class EdgeHoverMachine {
  private open = false;
  private locked = false;
  private resizing = false;
  private suppressedUntilExit = false;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private config: EdgeHoverConfig,
    private callbacks: EdgeHoverCallbacks,
  ) {}

  get isOpen(): boolean {
    return this.open;
  }

  get isLocked(): boolean {
    return this.locked || this.resizing;
  }

  updateConfig(next: EdgeHoverConfig): void {
    this.config = next;
    if (!next.enabled && this.open) {
      this.forceClose();
    }
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    if (locked) {
      this.clearCloseTimer();
    }
  }

  setResizing(resizing: boolean): void {
    this.resizing = resizing;
    if (resizing) {
      this.clearCloseTimer();
    }
  }

  handlePointerMove(clientX: number, buttons: number): void {
    if (!this.config.enabled) return;

    const inEdge = clientX >= 0 && clientX <= this.config.triggerWidthPx;
    const inPanel = this.open && clientX >= 0 && clientX <= this.config.panelWidthPx + 12;

    if (buttons !== 0 && !this.resizing) {
      // User is dragging on the webpage: suppress edge activation until cursor leaves edge after release
      this.clearOpenTimer();
      if (!this.open) {
        this.suppressedUntilExit = true;
      }
      return;
    }

    if (this.suppressedUntilExit) {
      if (!inEdge) {
        this.suppressedUntilExit = false;
      }
      return;
    }

    if (!this.open) {
      if (inEdge) {
        this.scheduleOpen();
      } else {
        this.clearOpenTimer();
      }
      return;
    }

    // Panel is open
    if (inPanel || this.locked || this.resizing) {
      this.clearCloseTimer();
    } else {
      this.scheduleClose();
    }
  }

  handlePointerLeavePanel(): void {
    if (!this.open || this.locked || this.resizing) return;
    this.scheduleClose();
  }

  handlePointerEnterPanel(): void {
    this.clearCloseTimer();
  }

  /**
   * Called when the cursor leaves the browser viewport (e.g. crossing to a secondary monitor
   * positioned to the left of the browser window). Cancels any pending open dwell so fast
   * cross-monitor traversal never triggers an unintended sidebar popup.
   */
  handleDocumentPointerLeave(): void {
    if (!this.open) {
      this.clearOpenTimer();
    }
  }

  handleOutsidePointerDown(clientX: number): void {
    this.clearOpenTimer();
    if (this.open && !this.resizing && clientX > this.config.panelWidthPx) {
      this.forceClose();
      this.suppressedUntilExit = true;
    } else if (!this.open) {
      this.suppressedUntilExit = true;
    }
  }

  handlePointerUp(clientX: number): void {
    if (clientX > this.config.triggerWidthPx) {
      this.suppressedUntilExit = false;
    }
  }

  forceOpen(): void {
    if (!this.config.enabled) return;
    this.clearOpenTimer();
    this.clearCloseTimer();
    if (!this.open) {
      this.open = true;
      this.callbacks.onOpen();
    }
  }

  forceClose(): void {
    this.clearOpenTimer();
    this.clearCloseTimer();
    if (this.open) {
      this.open = false;
      this.callbacks.onClose();
    }
  }

  dispose(): void {
    this.clearOpenTimer();
    this.clearCloseTimer();
  }

  private scheduleOpen(): void {
    if (this.openTimer !== undefined || this.open) return;
    if (this.config.openDelayMs <= 0) {
      this.open = true;
      this.callbacks.onOpen();
      return;
    }
    this.openTimer = setTimeout(() => {
      this.openTimer = undefined;
      if (!this.open && this.config.enabled) {
        this.open = true;
        this.callbacks.onOpen();
      }
    }, this.config.openDelayMs);
  }

  private scheduleClose(): void {
    if (this.closeTimer !== undefined || !this.open || this.locked || this.resizing) return;
    this.closeTimer = setTimeout(() => {
      this.closeTimer = undefined;
      if (this.open && !this.locked && !this.resizing) {
        this.open = false;
        this.callbacks.onClose();
      }
    }, this.config.closeDelayMs);
  }

  private clearOpenTimer(): void {
    if (this.openTimer !== undefined) {
      clearTimeout(this.openTimer);
      this.openTimer = undefined;
    }
  }

  private clearCloseTimer(): void {
    if (this.closeTimer !== undefined) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }
  }
}
