export enum EdgeDetectionState {
  IDLE = 'idle',
  PROXIMITY = 'proximity',
  BORDER = 'border',
}

export type EdgeDetectionConfig = {
  /**
   * 有効にすると pointerleave + velocity 推論で起動を試みる
   */
  pointerLeaveInferenceEnabled: boolean;
  /**
   * 左向き速度（px差分）。この値以下（負方向）のとき推論を許可する
   */
  snapVelocityThreshold: number;
  /**
   * Y方向速度の絶対値がこの値以下のときのみ推論を許可する（上下移動の誤発火防止）
   */
  maxVelocityYThreshold: number;
  /**
   * clientX がこの値以下なら「ビューポート左端に近い」とみなす
   */
  viewportEdgeThresholdPx: number;
  /**
   * screenX - window.screenX がこの値以下なら「ウィンドウ左端に近い」とみなす
   */
  windowEdgeThresholdPx: number;
  /**
   * 推論起動後のクールダウン（ms）
   */
  inferenceCooldownMs: number;
  /**
   * デバッグ用途の詳細ログ出力
   */
  debugLogging: boolean;
};

export const DEFAULT_EDGE_DETECTION_CONFIG: EdgeDetectionConfig = {
  pointerLeaveInferenceEnabled: true,
  snapVelocityThreshold: -6,
  maxVelocityYThreshold: 8,
  viewportEdgeThresholdPx: 96,
  windowEdgeThresholdPx: 24,
  inferenceCooldownMs: 400,
  debugLogging: false,
};

type ConfigListener = (config: EdgeDetectionConfig) => void;

let currentConfig: EdgeDetectionConfig = { ...DEFAULT_EDGE_DETECTION_CONFIG };
const listeners = new Set<ConfigListener>();

export function getEdgeDetectionConfig(): EdgeDetectionConfig {
  return currentConfig;
}

export function updateEdgeDetectionConfig(partial: Partial<EdgeDetectionConfig>) {
  currentConfig = { ...currentConfig, ...partial };
  listeners.forEach((listener) => {
    listener(currentConfig);
  });
}

export function subscribeEdgeDetectionConfig(listener: ConfigListener) {
  listeners.add(listener);
  listener(currentConfig);
  return () => listeners.delete(listener);
}
