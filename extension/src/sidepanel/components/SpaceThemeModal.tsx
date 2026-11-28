import { Minus, Moon, Plus, Shuffle, Sparkles, Sun, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import {
  ARC_SWATCHES,
  applyHarmonyFromPrimary,
  CURATED_THEME_PRESETS,
  createDefaultSpaceTheme,
  hexToOrbitPoint,
  normalizeHex,
  pointToOrbitHex,
  sanitizeSpaceTheme,
} from '../../core/space-theme';
import type { MessageKey } from '../../core/i18n';
import type { Space, SpaceAppearance, SpaceHarmonyMode, SpaceTheme } from '../../core/types';
import { useT } from '../i18n';

interface SpaceThemeModalProps {
  space: Space | null;
  onPreview: (theme: SpaceTheme | null) => void;
  onSave: (spaceId: string, theme: SpaceTheme) => void;
  onClose: (meta?: { backdropOutsideSidebar?: boolean }) => void;
  sidebarWidthPx?: number;
}

const HARMONIES: ReadonlyArray<{ id: SpaceHarmonyMode; label: MessageKey }> = [
  { id: 'free', label: 'themeModal.harmonyFree' },
  { id: 'analogous', label: 'themeModal.harmonyAnalogous' },
  { id: 'complementary', label: 'themeModal.harmonyComplementary' },
  { id: 'triadic', label: 'themeModal.harmonyTriadic' },
];

const APPEARANCES: ReadonlyArray<{
  id: SpaceAppearance;
  label: MessageKey;
  icon: 'auto' | 'light' | 'dark';
}> = [
  { id: 'auto', label: 'themeModal.appearanceAuto', icon: 'auto' },
  { id: 'light', label: 'themeModal.appearanceLight', icon: 'light' },
  { id: 'dark', label: 'themeModal.appearanceDark', icon: 'dark' },
];

const GRAIN_DOT_ANGLES = Array.from({ length: 12 }, (_, i) => i * 30 - 150);

export function SpaceThemeModal({
  space,
  onPreview,
  onSave,
  onClose,
  sidebarWidthPx = 290,
}: SpaceThemeModalProps) {
  const t = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropCloseRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<SpaceTheme>(() => createDefaultSpaceTheme(-1));
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [draggingNode, setDraggingNode] = useState<number | null>(null);
  const [hexInput, setHexInput] = useState('#232325');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (space) {
      backdropCloseRef.current = false;
      const initial = sanitizeSpaceTheme(space.theme, space.hue);
      setDraft(initial);
      setSelectedIdx(0);
      setHexInput(initial.nodes[0]?.hex ?? '#232325');
      onPreview(initial);
      if (!dialog.open) dialog.showModal();
    } else {
      onPreview(null);
      if (dialog.open) dialog.close();
    }
  }, [space, onPreview]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      onPreview(null);
      const backdropOutsideSidebar = backdropCloseRef.current;
      backdropCloseRef.current = false;
      onClose({ backdropOutsideSidebar });
    };
    const handlePointerDown = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      const outsideDialog =
        e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      backdropCloseRef.current = outsideDialog && e.clientX > sidebarWidthPx + 14;
    };
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('pointerdown', handlePointerDown);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose, onPreview, sidebarWidthPx]);

  const updateDraft = (updater: (prev: SpaceTheme) => SpaceTheme) => {
    setDraft((prev) => {
      const next = updater(prev);
      onPreview(next);
      return next;
    });
  };

  const selectNode = (idx: number, currentNodes = draft.nodes) => {
    const clamped = Math.max(0, Math.min(currentNodes.length - 1, idx));
    setSelectedIdx(clamped);
    setHexInput(currentNodes[clamped]?.hex ?? '#6b7cff');
  };

  const moveNodeToClientPoint = (nodeIdx: number, clientX: number, clientY: number) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return;
    const x = Math.max(0.06, Math.min(0.94, (clientX - box.left) / box.width));
    const y = Math.max(0.08, Math.min(0.92, (clientY - box.top) / box.height));
    const hex = pointToOrbitHex(x, y);
    setHexInput(hex);

    updateDraft((prev) => {
      const nextNodes = prev.nodes.map((n, i) => (i === nodeIdx ? { x, y, hex } : n));
      const harmonized =
        nodeIdx === 0 && prev.harmony !== 'free'
          ? applyHarmonyFromPrimary(nextNodes, prev.harmony)
          : nextNodes;
      return {
        ...prev,
        nodes: harmonized,
      };
    });
  };

  const handleAddNode = () => {
    if (draft.nodes.length >= 3) return;
    updateDraft((prev) => {
      if (prev.nodes.length >= 3) return prev;
      const defaults = [
        { x: 0.76, y: 0.42 },
        { x: 0.32, y: 0.82 },
      ];
      const pos = defaults[prev.nodes.length - 1] ?? { x: 0.3, y: 0.78 };
      const added = [...prev.nodes, { ...pos, hex: pointToOrbitHex(pos.x, pos.y) }];
      const nextNodes =
        prev.harmony !== 'free' ? applyHarmonyFromPrimary(added, prev.harmony) : added;
      const nextIdx = nextNodes.length - 1;
      setSelectedIdx(nextIdx);
      setHexInput(nextNodes[nextIdx]?.hex ?? '#6cb4dc');
      return {
        ...prev,
        nodes: nextNodes,
        intensity: Math.max(prev.intensity, 48),
      };
    });
  };

  const handleRemoveNode = () => {
    if (draft.nodes.length <= 1) return;
    updateDraft((prev) => {
      if (prev.nodes.length <= 1) return prev;
      const removeAt = selectedIdx < prev.nodes.length ? selectedIdx : prev.nodes.length - 1;
      const nextNodes = prev.nodes.filter((_, i) => i !== removeAt);
      const nextIdx = Math.max(0, Math.min(nextNodes.length - 1, removeAt - 1));
      setSelectedIdx(nextIdx);
      setHexInput(nextNodes[nextIdx]?.hex ?? '#232325');
      return { ...prev, nodes: nextNodes };
    });
  };

  const applySwatch = (hex: string) => {
    const norm = normalizeHex(hex);
    const pos = hexToOrbitPoint(norm);
    setHexInput(norm);
    updateDraft((prev) => {
      const idx = Math.min(selectedIdx, prev.nodes.length - 1);
      const nextNodes = prev.nodes.map((n, i) => (i === idx ? { ...pos, hex: norm } : n));
      const harmonized =
        idx === 0 && prev.harmony !== 'free'
          ? applyHarmonyFromPrimary(nextNodes, prev.harmony)
          : nextNodes;
      return {
        ...prev,
        nodes: harmonized,
        intensity:
          norm === '#222224' && prev.nodes.length === 1 ? 15 : Math.max(prev.intensity, 45),
      };
    });
  };

  const handleShuffle = () => {
    const baseAngle = Math.random() * Math.PI * 2;
    const count = Math.max(2, draft.nodes.length);
    const modes: SpaceHarmonyMode[] = ['analogous', 'complementary', 'triadic'];
    const harmony = modes[Math.floor(Math.random() * modes.length)] ?? 'complementary';
    const x0 = 0.5 + Math.cos(baseAngle) * 0.34;
    const y0 = 0.5 + Math.sin(baseAngle) * 0.34;
    const rawNodes = Array.from({ length: count }, (_, i) =>
      i === 0 ? { x: x0, y: y0, hex: pointToOrbitHex(x0, y0) } : { x: 0.5, y: 0.5, hex: '#888888' },
    );
    const nodes = applyHarmonyFromPrimary(rawNodes, harmony);
    setSelectedIdx(0);
    setHexInput(nodes[0]?.hex ?? '#6b7cff');
    updateDraft((prev) => ({
      ...prev,
      nodes,
      harmony,
      intensity: Math.round(45 + Math.random() * 32),
      grain: Math.round(25 + Math.random() * 45),
      angle: Math.round(135 + Math.random() * 55),
    }));
  };

  const updateIntensityFromPointer = (clientX: number) => {
    const box = waveRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - box.left) / box.width));
    updateDraft((prev) => ({ ...prev, intensity: Math.round(ratio * 100) }));
  };

  const activeNode = draft.nodes[Math.min(selectedIdx, draft.nodes.length - 1)];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="arcline-theme-dialog"
    >
      <div className="flex flex-col gap-3.5 p-4" style={{ color: 'var(--ink)' }}>
        {/* Header + Arc Appearance Pills (Auto / Light / Dark) */}
        <div className="flex items-center justify-between gap-2">
          <h1 id={titleId} className="m-0 truncate text-[13px] font-semibold">
            {space ? t('themeModal.title', { name: space.name }) : t('themeModal.titleFallback')}
          </h1>

          <fieldset
            aria-label={t('themeModal.appearanceGroup')}
            className="m-0 flex items-center gap-0.5 rounded-lg border-0 p-0.5"
            style={{ backgroundColor: 'var(--bg-canvas)' }}
          >
            {APPEARANCES.map((mode) => {
              const active = draft.appearance === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  title={t(mode.label)}
                  aria-label={t(mode.label)}
                  aria-pressed={active}
                  onClick={() => updateDraft((prev) => ({ ...prev, appearance: mode.id }))}
                  className="flex h-6 w-7 items-center justify-center rounded-md transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--bg-active)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-muted)',
                    boxShadow: active ? 'var(--pill-shadow)' : 'none',
                  }}
                >
                  {mode.icon === 'auto' && <Sparkles size={13} />}
                  {mode.icon === 'light' && <Sun size={13} />}
                  {mode.icon === 'dark' && <Moon size={13} />}
                </button>
              );
            })}
          </fieldset>

          <button
            type="button"
            aria-label={t('themeModal.close')}
            onClick={() => dialogRef.current?.close()}
            className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--hover)] cursor-pointer"
            style={{ color: 'var(--ink-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Arc Interactive 2D Color Orbit Canvas with Draggable Multi-Nodes */}
        <div
          ref={canvasRef}
          data-theme-orbit-canvas="true"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDraggingNode(selectedIdx);
            moveNodeToClientPoint(selectedIdx, e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (draggingNode === null) return;
            moveNodeToClientPoint(draggingNode, e.clientX, e.clientY);
          }}
          onPointerUp={() => setDraggingNode(null)}
          onPointerCancel={() => setDraggingNode(null)}
          className="relative h-[212px] w-full overflow-hidden rounded-xl border select-none touch-none cursor-crosshair"
          style={{
            borderColor: 'var(--rule)',
            backgroundColor: '#2c2e36',
            backgroundImage: [
              ...draft.nodes.map(
                (n) =>
                  `radial-gradient(circle at ${Math.round(n.x * 100)}% ${Math.round(n.y * 100)}%, ${n.hex}52 0%, transparent 56%)`,
              ),
              'radial-gradient(rgb(255 255 255 / 0.16) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: [...draft.nodes.map(() => '100% 100%'), '10px 10px'].join(', '),
          }}
        >
          {/* Subtle connecting polygon lines between gradient anchors */}
          {draft.nodes.length >= 2 && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {(['primary-edge', 'secondary-edge', 'tertiary-edge'] as const)
                .slice(0, draft.nodes.length)
                .map((edgeId, i) => {
                  const node = draft.nodes[i];
                  const next = draft.nodes[(i + 1) % draft.nodes.length];
                  if (!node || !next || (draft.nodes.length === 2 && i === 1)) return null;
                  return (
                    <line
                      key={edgeId}
                      x1={node.x * 100}
                      y1={node.y * 100}
                      x2={next.x * 100}
                      y2={next.y * 100}
                      stroke="rgba(255,255,255,0.28)"
                      strokeWidth="0.6"
                      strokeDasharray="1.8 1.8"
                    />
                  );
                })}
            </svg>
          )}

          {/* Draggable Color Anchor Nodes */}
          {(['primary-node', 'secondary-node', 'tertiary-node'] as const)
            .slice(0, draft.nodes.length)
            .map((nodeSlotKey, idx) => {
              const node = draft.nodes[idx];
              if (!node) return null;
              const isPrimary = idx === 0;
              const isSelected = idx === selectedIdx;
              const size = isPrimary ? 28 : 21;
              return (
                <button
                  key={`${nodeSlotKey}-${draft.nodes.length}`}
                  type="button"
                  aria-label={t('themeModal.nodeLabel', { index: idx + 1, hex: node.hex })}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    selectNode(idx);
                    setDraggingNode(idx);
                    canvasRef.current?.setPointerCapture(e.pointerId);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(idx);
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-shadow cursor-grab active:cursor-grabbing"
                  style={{
                    left: `${node.x * 100}%`,
                    top: `${node.y * 100}%`,
                    width: size,
                    height: size,
                    backgroundColor: node.hex,
                    border: `${isPrimary ? 2.5 : 2}px solid #ffffff`,
                    boxShadow: isSelected
                      ? '0 0 0 3px rgb(255 255 255 / 0.32), 0 4px 12px rgb(0 0 0 / 0.45)'
                      : '0 2px 8px rgb(0 0 0 / 0.4)',
                  }}
                />
              );
            })}

          {/* Arc-style - / + node buttons inside bottom of orbit canvas */}
          <div className="absolute right-0 bottom-2 left-0 flex items-center justify-center gap-4">
            <button
              type="button"
              title={t('themeModal.removeNode')}
              aria-label={t('themeModal.removeNode')}
              disabled={draft.nodes.length <= 1}
              onClick={handleRemoveNode}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/85 transition-colors hover:bg-black/50 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <Minus size={13} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              title={t('themeModal.addNodeTitle')}
              aria-label={t('themeModal.addNode')}
              disabled={draft.nodes.length >= 3}
              onClick={handleAddNode}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white/85 transition-colors hover:bg-black/50 hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Powered-Up Controls: Harmony Modes + Shuffle + Exact Hex Color */}
        <div className="flex items-center justify-between gap-1.5">
          <div
            className="flex flex-1 items-center gap-0.5 rounded-lg p-0.5"
            style={{ backgroundColor: 'var(--bg-canvas)' }}
          >
            {HARMONIES.map((h) => {
              const active = draft.harmony === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    updateDraft((prev) => ({
                      ...prev,
                      harmony: h.id,
                      nodes:
                        h.id === 'free' ? prev.nodes : applyHarmonyFromPrimary(prev.nodes, h.id),
                    }));
                  }}
                  className="flex-1 rounded-md py-1 text-[10.5px] font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--bg-active)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-muted)',
                    boxShadow: active ? 'var(--pill-shadow)' : 'none',
                  }}
                >
                  {t(h.label)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            title={t('themeModal.shuffle')}
            aria-label={t('themeModal.shuffle')}
            onClick={handleShuffle}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--hover)] cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--ink-muted)',
            }}
          >
            <Shuffle size={13} />
          </button>
        </div>

        {/* Selected Node Direct Hex + Color Picker + Curated Arc Swatches */}
        <div className="flex items-center gap-1.5">
          <label
            title={t('themeModal.fineTune')}
            className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border cursor-pointer"
            style={{
              backgroundColor: activeNode?.hex ?? '#6b7cff',
              borderColor: 'var(--rule)',
            }}
          >
            <input
              type="color"
              aria-label={t('themeModal.colorPicker')}
              value={activeNode?.hex ?? '#6b7cff'}
              onChange={(e) => applySwatch(e.target.value)}
              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            />
          </label>
          <input
            type="text"
            aria-label={t('themeModal.hexLabel')}
            value={hexInput}
            onChange={(e) => {
              const raw = e.target.value;
              setHexInput(raw);
              if (/^#?[0-9a-fA-F]{6}$/.test(raw.trim())) {
                applySwatch(raw);
              }
            }}
            className="h-6 w-[66px] rounded-md border px-1.5 font-mono text-[11px] outline-none focus:border-[var(--accent)]"
            style={{
              borderColor: 'var(--rule)',
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--ink)',
            }}
          />

          <div className="arcline-hscroll flex flex-1 items-center gap-1.5 py-0.5">
            {ARC_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={t('themeModal.swatch', { hex: swatch })}
                onClick={() => applySwatch(swatch)}
                className="h-5 w-5 shrink-0 rounded-full border transition-transform hover:scale-110 cursor-pointer"
                style={{
                  backgroundColor: swatch,
                  borderColor: 'var(--rule)',
                }}
              />
            ))}
          </div>
        </div>

        {/* 1-Click Multi-Color Presets (Arc Active Matter, Obsidian, Aurora, Dusk, Sakura, Nordic) */}
        <div className="arcline-hscroll flex items-center gap-1.5">
          {CURATED_THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                const clone: SpaceTheme = {
                  ...preset.theme,
                  nodes: preset.theme.nodes.map((n) => ({ ...n })),
                };
                setSelectedIdx(0);
                setHexInput(clone.nodes[0]?.hex ?? '#232325');
                updateDraft(() => clone);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-colors hover:bg-[var(--hover)] cursor-pointer"
              style={{
                borderColor: 'var(--rule)',
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--ink)',
              }}
            >
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full border"
                style={{
                  borderColor: 'var(--rule)',
                  background:
                    preset.theme.nodes.length > 1
                      ? `linear-gradient(135deg, ${preset.theme.nodes.map((n) => n.hex).join(', ')})`
                      : preset.theme.nodes[0]?.hex,
                }}
              />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>

        {/* Arc Signature Bottom Row: Wavy Intensity Slider + Rotary Dotted Grain Dial */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Wavy Intensity Slider */}
          <div className="flex flex-1 flex-col gap-1">
            <div
              className="flex items-center justify-between text-[10.5px]"
              style={{ color: 'var(--ink-muted)' }}
            >
              <span>{t('themeModal.vividness')}</span>
              <span className="tabular-nums">{draft.intensity}%</span>
            </div>
            <div
              ref={waveRef}
              role="slider"
              tabIndex={0}
              aria-label={t('themeModal.vividnessLabel')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={draft.intensity}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                updateIntensityFromPointer(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 0) return;
                updateIntensityFromPointer(e.clientX);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  updateDraft((p) => ({ ...p, intensity: Math.min(100, p.intensity + 5) }));
                } else if (e.key === 'ArrowLeft') {
                  updateDraft((p) => ({ ...p, intensity: Math.max(0, p.intensity - 5) }));
                }
              }}
              className="relative flex h-8 items-center select-none touch-none cursor-ew-resize"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 180 28"
                className="h-7 w-full overflow-visible"
                fill="none"
              >
                {/* Muted full wave */}
                <path
                  d="M 4 14 Q 14 2, 24 14 T 44 14 T 64 14 T 84 14 T 104 14 T 124 14 T 144 14 T 164 14 T 176 14"
                  stroke="currentColor"
                  strokeOpacity="0.22"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Illuminated active wave clipped by intensity */}
                <clipPath id="arcline-wave-clip">
                  <rect
                    x="0"
                    y="0"
                    width={Math.max(4, (draft.intensity / 100) * 180)}
                    height="28"
                  />
                </clipPath>
                <path
                  clipPath="url(#arcline-wave-clip)"
                  d="M 4 14 Q 14 2, 24 14 T 44 14 T 64 14 T 84 14 T 104 14 T 124 14 T 144 14 T 164 14 T 176 14"
                  stroke="currentColor"
                  strokeOpacity="0.88"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              </svg>
              {/* Arc tall pill thumb */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 h-6 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${4 + (draft.intensity / 100) * 92}%`,
                  backgroundColor: 'var(--ink)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}
              />
            </div>
          </div>

          {/* Arc Rotary Dotted Grain Dial */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="text-[10.5px] tabular-nums" style={{ color: 'var(--ink-muted)' }}>
              {t('themeModal.grain', { value: draft.grain })}
            </span>
            <button
              type="button"
              role="slider"
              aria-label={t('themeModal.grainLabel')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={draft.grain}
              title={t('themeModal.grainTitle')}
              onClick={() =>
                updateDraft((p) => ({
                  ...p,
                  grain: p.grain >= 100 ? 0 : Math.min(100, p.grain + 25),
                }))
              }
              onPointerDown={(startEvent) => {
                const startY = startEvent.clientY;
                const startGrain = draft.grain;
                let moved = false;
                const onMove = (ev: PointerEvent) => {
                  const dy = startY - ev.clientY;
                  if (Math.abs(dy) > 3) moved = true;
                  if (!moved) return;
                  const next = Math.max(0, Math.min(100, Math.round(startGrain + dy * 0.9)));
                  updateDraft((p) => ({ ...p, grain: next }));
                };
                const onUp = () => {
                  window.removeEventListener('pointermove', onMove, true);
                  window.removeEventListener('pointerup', onUp, true);
                };
                window.addEventListener('pointermove', onMove, true);
                window.addEventListener('pointerup', onUp, true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                  updateDraft((p) => ({ ...p, grain: Math.min(100, p.grain + 10) }));
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                  updateDraft((p) => ({ ...p, grain: Math.max(0, p.grain - 10) }));
                }
              }}
              className="relative grid h-11 w-11 place-items-center rounded-full cursor-ns-resize"
            >
              <svg aria-hidden="true" viewBox="0 0 44 44" className="h-11 w-11">
                {GRAIN_DOT_ANGLES.map((deg, idx) => {
                  const rad = (deg * Math.PI) / 180;
                  const cx = 22 + Math.cos(rad) * 18.5;
                  const cy = 22 + Math.sin(rad) * 18.5;
                  const threshold = ((idx + 1) / GRAIN_DOT_ANGLES.length) * 100;
                  const lit = draft.grain >= threshold - 4;
                  return (
                    <circle
                      key={deg}
                      cx={cx}
                      cy={cy}
                      r={lit ? 1.55 : 1.15}
                      fill="currentColor"
                      fillOpacity={lit ? 0.92 : 0.24}
                    />
                  );
                })}
                {/* Center tactile knob cap */}
                <circle
                  cx="22"
                  cy="22"
                  r="12"
                  fill="currentColor"
                  fillOpacity="0.14"
                  stroke="currentColor"
                  strokeOpacity="0.28"
                  strokeWidth="1"
                />
                {/* Indicator tick rotating with grain */}
                <line
                  x1="22"
                  y1="22"
                  x2={22 + Math.cos(((-150 + (draft.grain / 100) * 300) * Math.PI) / 180) * 9}
                  y2={22 + Math.sin(((-150 + (draft.grain / 100) * 300) * Math.PI) / 180) * 9}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="flex items-center justify-end gap-2 border-t pt-2.5"
          style={{ borderColor: 'var(--rule)' }}
        >
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--hover)] cursor-pointer"
            style={{
              borderColor: 'var(--rule)',
              color: 'var(--ink-muted)',
            }}
          >
            {t('themeModal.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (space) onSave(space.id, draft);
              dialogRef.current?.close();
            }}
            className="rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {t('themeModal.apply')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
