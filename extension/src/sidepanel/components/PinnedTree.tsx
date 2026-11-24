import { FolderPlus, Minus, Palette, RotateCcw, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { collectOpenPins, countOpenPins } from '../../core/derive';
import type { LiveTab, PinnedFolder, PinnedNode, PinnedTab } from '../../core/types';
import { useT } from '../i18n';
import { Favicon } from './Favicon';
import { DRAG_MIME, type DragPayload, readDragPayload } from './FavoritesGrid';
import { SpaceGlyph } from './SpaceGlyph';

export { SpaceGlyph };

/** Authentic Arc Browser folder icon: crisp outlined folder (closed) & tilted open folder (expanded). */
function ArcFolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="shrink-0 transition-transform duration-150"
      >
        <path
          d="M2.5 5.5C2.5 4.4 3.4 3.5 4.5 3.5H7.8C8.3 3.5 8.8 3.7 9.1 4.1L10.3 5.5H15.5C16.6 5.5 17.5 6.4 17.5 7.5V8.5H4.2L2.5 14.5V5.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.72"
        />
        <path
          d="M3.6 8.5H17.2C17.9 8.5 18.4 9.1 18.2 9.8L16.7 15.2C16.5 15.9 15.9 16.5 15.1 16.5H3.9C3.1 16.5 2.5 15.8 2.7 15L4.1 9.6C4.2 9 3.6 8.5 3.6 8.5Z"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="shrink-0 transition-transform duration-150"
    >
      <path
        d="M2.5 5.5C2.5 4.4 3.4 3.5 4.5 3.5H7.7C8.2 3.5 8.7 3.7 9 4.1L10.2 5.5H15.5C16.6 5.5 17.5 6.4 17.5 7.5V14.5C17.5 15.6 16.6 16.5 15.5 16.5H4.5C3.4 16.5 2.5 15.6 2.5 14.5V5.5Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M2.5 7.5H17.5" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
    </svg>
  );
}

interface PinnedTreeProps {
  spaceId: string;
  spaceName: string;
  spaceIcon?: string;
  nodes: PinnedNode[];
  tabs: Map<number, LiveTab>;
  activeTabId?: number;
  openFolders: Set<string>;
  showOpenInCollapsedFolders: boolean;
  renamingId: string | null;
  renamingSpace: boolean;
  onStartRenameSpace: () => void;
  onFinishRenameSpace: (nextName: string | null) => void;
  onOpenIconPicker: () => void;
  onSpaceHeaderContextMenu: (e: React.MouseEvent) => void;
  onFinishRename: (id: string, nextTitle: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onOpenPin: (pinId: string) => void;
  onUnloadPin: (pinId: string) => void;
  onResetPin: (pinId: string) => void;
  onToggleMute: (tabId: number) => void;
  onCreateFolder: (parentId: string) => void;
  onOpenTheme: () => void;
  onPinActiveTab: (parentId: string) => void;
  onDropOnParent: (payload: DragPayload, parentId: string, index?: number) => void;
  onPinContextMenu: (e: React.MouseEvent, pin: PinnedTab) => void;
  onFolderContextMenu: (e: React.MouseEvent, folder: PinnedFolder) => void;
}

type DropZone = 'before' | 'inside' | 'after';

export function PinnedTree({
  spaceId,
  spaceName,
  spaceIcon,
  nodes,
  tabs,
  activeTabId,
  openFolders,
  showOpenInCollapsedFolders,
  renamingId,
  renamingSpace,
  onStartRenameSpace,
  onFinishRenameSpace,
  onOpenIconPicker,
  onSpaceHeaderContextMenu,
  onFinishRename,
  onToggleFolder,
  onOpenPin,
  onUnloadPin,
  onResetPin,
  onToggleMute,
  onCreateFolder,
  onOpenTheme,
  onPinActiveTab,
  onDropOnParent,
  onPinContextMenu,
  onFolderContextMenu,
}: PinnedTreeProps) {
  const t = useT();
  const [sectionDragOver, setSectionDragOver] = useState(false);
  const [draftSpaceName, setDraftSpaceName] = useState(spaceName);
  const spaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingSpace) {
      setDraftSpaceName(spaceName);
      requestAnimationFrame(() => {
        spaceInputRef.current?.focus();
        spaceInputRef.current?.select();
      });
    }
  }, [renamingSpace, spaceName]);

  return (
    <section
      aria-label={t('sidebar.pinned.sectionLabel', { name: spaceName })}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        setSectionDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setSectionDragOver(false);
        }
      }}
      onDrop={(e) => {
        if (e.defaultPrevented) return;
        e.preventDefault();
        setSectionDragOver(false);
        const payload = readDragPayload(e.dataTransfer);
        if (payload) onDropOnParent(payload, spaceId);
      }}
      className="px-3 pt-1 pb-1"
    >
      {/* Authentic Arc Quiet Space Header (clickable icon picker + double-click inline rename + right-click menu) */}
      <div
        className="group/spacehead mb-1.5 flex items-center justify-between gap-2 border-b pb-1.5 pl-0.5 pr-0.5"
        style={{ borderColor: 'var(--rule)' }}
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5"
          style={{ color: 'var(--ink-muted)' }}
        >
          <button
            type="button"
            title={t('sidebar.pinned.changeIcon')}
            aria-label={t('sidebar.pinned.changeIcon')}
            onClick={onOpenIconPicker}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSpaceHeaderContextMenu(e);
            }}
            className="grid size-6 shrink-0 place-items-center rounded-md transition-all hover:bg-[var(--hover)] hover:text-[var(--ink)] active:scale-95 cursor-pointer"
          >
            <SpaceGlyph icon={spaceIcon} size={14} />
          </button>

          {renamingSpace ? (
            <input
              ref={spaceInputRef}
              type="text"
              aria-label={t('sidebar.pinned.renameSpaceLabel')}
              value={draftSpaceName}
              onChange={(e) => setDraftSpaceName(e.target.value)}
              onBlur={() => onFinishRenameSpace(draftSpaceName)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onFinishRenameSpace(draftSpaceName);
                if (e.key === 'Escape') onFinishRenameSpace(null);
              }}
              className="h-6 min-w-0 flex-1 rounded-md px-1.5 text-[13px] font-semibold outline-1 outline-[var(--accent)]"
              style={{ backgroundColor: 'var(--pill)', color: 'var(--ink)' }}
            />
          ) : (
            <button
              type="button"
              data-space-header-title="true"
              title={t('sidebar.pinned.spaceNameHint')}
              onDoubleClick={onStartRenameSpace}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSpaceHeaderContextMenu(e);
              }}
              className="min-w-0 flex-1 truncate rounded border-0 bg-transparent px-0.5 py-0.5 text-left text-[13px] font-semibold tracking-[-0.005em] transition-colors hover:text-[var(--ink)] cursor-pointer"
              style={{ color: 'inherit' }}
            >
              {spaceName}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title={t('sidebar.pinned.editThemeTitle')}
            aria-label={t('sidebar.pinned.editThemeLabel')}
            onClick={onOpenTheme}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-55 transition-all hover:bg-[var(--hover)] hover:text-[var(--ink)] hover:opacity-100 active:scale-95 cursor-pointer"
            style={{ color: 'var(--ink-muted)' }}
          >
            <Palette size={13.5} strokeWidth={1.85} />
          </button>
          <button
            type="button"
            title={t('sidebar.pinned.newFolder')}
            aria-label={t('sidebar.pinned.newFolder')}
            onClick={() => onCreateFolder(spaceId)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-60 transition-all hover:bg-[var(--hover)] hover:text-[var(--ink)] hover:opacity-100 active:scale-95 cursor-pointer"
            style={{ color: 'var(--ink-muted)' }}
          >
            <FolderPlus size={14} strokeWidth={1.85} />
          </button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div
          className="mt-1 rounded-[10px] border border-dashed px-3 py-2.5 text-center text-[12px] transition-colors"
          style={{
            borderColor: sectionDragOver ? 'var(--accent)' : 'var(--rule)',
            color: 'var(--ink-muted)',
            backgroundColor: sectionDragOver
              ? 'color-mix(in oklch, var(--accent) 10%, var(--hover))'
              : 'transparent',
          }}
        >
          <p className="m-0">{t('sidebar.pinned.emptyHint')}</p>
          <button
            type="button"
            onClick={() => onPinActiveTab(spaceId)}
            className="mt-1 font-medium underline underline-offset-2 cursor-pointer"
            style={{ color: 'var(--ink)' }}
          >
            {t('sidebar.pinned.pinCurrent')}
          </button>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {nodes.map((node, index) => (
            <PinnedNodeRow
              key={node.id}
              node={node}
              parentId={spaceId}
              index={index}
              depth={0}
              tabs={tabs}
              activeTabId={activeTabId}
              openFolders={openFolders}
              showOpenInCollapsedFolders={showOpenInCollapsedFolders}
              renamingId={renamingId}
              onFinishRename={onFinishRename}
              onToggleFolder={onToggleFolder}
              onOpenPin={onOpenPin}
              onUnloadPin={onUnloadPin}
              onResetPin={onResetPin}
              onToggleMute={onToggleMute}
              onDropOnParent={onDropOnParent}
              onPinContextMenu={onPinContextMenu}
              onFolderContextMenu={onFolderContextMenu}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface PinnedNodeRowProps {
  node: PinnedNode;
  parentId: string;
  index: number;
  depth: number;
  tabs: Map<number, LiveTab>;
  activeTabId?: number;
  openFolders: Set<string>;
  showOpenInCollapsedFolders: boolean;
  renamingId: string | null;
  onFinishRename: (id: string, nextTitle: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onOpenPin: (pinId: string) => void;
  onUnloadPin: (pinId: string) => void;
  onResetPin: (pinId: string) => void;
  onToggleMute: (tabId: number) => void;
  onDropOnParent: (payload: DragPayload, parentId: string, index?: number) => void;
  onPinContextMenu: (e: React.MouseEvent, pin: PinnedTab) => void;
  onFolderContextMenu: (e: React.MouseEvent, folder: PinnedFolder) => void;
}

function PinnedNodeRow({
  node,
  parentId,
  index,
  depth,
  tabs,
  activeTabId,
  openFolders,
  showOpenInCollapsedFolders,
  renamingId,
  onFinishRename,
  onToggleFolder,
  onOpenPin,
  onUnloadPin,
  onResetPin,
  onToggleMute,
  onDropOnParent,
  onPinContextMenu,
  onFolderContextMenu,
}: PinnedNodeRowProps) {
  const t = useT();
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const [draggingSelf, setDraggingSelf] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const isRenaming = renamingId === node.id;

  useEffect(() => {
    if (isRenaming) {
      setDraftTitle(node.title);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming, node.title]);

  const isActivePin = node.kind === 'pin' && node.tabId !== undefined && node.tabId === activeTabId;
  const isFolderOpen = node.kind === 'folder' && openFolders.has(node.id);
  const [renderFolderChildren, setRenderFolderChildren] = useState(isFolderOpen);

  useEffect(() => {
    if (node.kind !== 'folder') return;
    if (isFolderOpen) {
      setRenderFolderChildren(true);
      return;
    }
    // Keep folder children mounted during the 185ms collapse transition so they smoothly tuck back inside
    const timer = setTimeout(() => {
      setRenderFolderChildren(false);
    }, 185);
    return () => clearTimeout(timer);
  }, [node.kind, isFolderOpen]);

  useEffect(() => {
    if (isActivePin) {
      rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isActivePin]);

  const computeZone = (e: React.DragEvent, allowInside: boolean): DropZone => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / Math.max(1, rect.height);
    if (allowInside && ratio > 0.24 && ratio < 0.76) return 'inside';
    return ratio < 0.5 ? 'before' : 'after';
  };

  const paddingLeft = 10 + depth * 18;

  if (node.kind === 'folder') {
    const isOpen = openFolders.has(node.id);
    const openCount = countOpenPins(node.children);
    const collapsedOpenPins =
      !isOpen && showOpenInCollapsedFolders ? collectOpenPins(node.children) : [];
    const dropClass =
      dropZone === 'before'
        ? 'drop-line-top'
        : dropZone === 'after'
          ? 'drop-line-bottom'
          : dropZone === 'inside'
            ? 'drop-folder-target'
            : '';

    return (
      <li
        draggable={!isRenaming}
        style={{ opacity: draggingSelf ? 0.42 : 1 }}
        onDragStart={(e) => {
          e.stopPropagation();
          setDraggingSelf(true);
          e.dataTransfer.setData(
            DRAG_MIME,
            JSON.stringify({ kind: 'folder', id: node.id } satisfies DragPayload),
          );
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          setDraggingSelf(false);
          setDropZone(null);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
          e.preventDefault();
          e.stopPropagation();
          setDropZone(computeZone(e, true));
        }}
        onDragLeave={() => setDropZone(null)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const zone = dropZone ?? computeZone(e, true);
          setDropZone(null);
          setDraggingSelf(false);
          const payload = readDragPayload(e.dataTransfer);
          if (!payload) return;
          if (zone === 'inside') onDropOnParent(payload, node.id);
          else onDropOnParent(payload, parentId, zone === 'before' ? index : index + 1);
        }}
      >
        <div
          className={`group flex h-[36px] items-center gap-3 rounded-[10px] pr-2.5 text-[13.5px] transition-[background-color,outline-color] duration-100 hover:bg-[var(--hover)] ${dropClass}`}
          style={{ paddingLeft }}
        >
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => onFinishRename(node.id, draftTitle)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onFinishRename(node.id, draftTitle);
                if (e.key === 'Escape') onFinishRename(node.id, null);
              }}
              className="w-full rounded-md px-1.5 py-0.5 text-[13.5px] outline-1 outline-[var(--accent)]"
              style={{ backgroundColor: 'var(--pill)', color: 'var(--ink)' }}
            />
          ) : (
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => onToggleFolder(node.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onFolderContextMenu(e, node);
              }}
              className="flex h-full min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
            >
              <span className="grid size-[18px] shrink-0 place-items-center">
                <ArcFolderIcon open={isOpen} />
              </span>
              <span className="arcline-title-fade min-w-0 flex-1 font-semibold">{node.title}</span>
              {!isOpen && openCount > 0 && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.2 text-[10.5px] font-medium tabular-nums"
                  style={{
                    backgroundColor: 'var(--tile)',
                    color: 'var(--ink-muted)',
                  }}
                >
                  {openCount}
                </span>
              )}
            </button>
          )}
        </div>

        {node.children.length > 0 && (
          <div
            className="arcline-folder-children"
            data-open={isOpen ? 'true' : 'false'}
            aria-hidden={!isOpen}
          >
            <ul
              className={`m-0 flex min-h-0 list-none flex-col overflow-hidden p-0 ${
                renderFolderChildren ? 'gap-0.5 pt-0.5' : ''
              }`}
            >
              {renderFolderChildren &&
                node.children.map((child, childIdx) => (
                  <PinnedNodeRow
                    key={child.id}
                    node={child}
                    parentId={node.id}
                    index={childIdx}
                    depth={depth + 1}
                    tabs={tabs}
                    activeTabId={activeTabId}
                    openFolders={openFolders}
                    showOpenInCollapsedFolders={showOpenInCollapsedFolders}
                    renamingId={renamingId}
                    onFinishRename={onFinishRename}
                    onToggleFolder={onToggleFolder}
                    onOpenPin={onOpenPin}
                    onUnloadPin={onUnloadPin}
                    onResetPin={onResetPin}
                    onToggleMute={onToggleMute}
                    onDropOnParent={onDropOnParent}
                    onPinContextMenu={onPinContextMenu}
                    onFolderContextMenu={onFolderContextMenu}
                  />
                ))}
            </ul>
          </div>
        )}

        {!renderFolderChildren && collapsedOpenPins.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {collapsedOpenPins.map((pin, childIdx) => (
              <PinnedNodeRow
                key={pin.id}
                node={pin}
                parentId={node.id}
                index={childIdx}
                depth={depth + 1}
                tabs={tabs}
                activeTabId={activeTabId}
                openFolders={openFolders}
                showOpenInCollapsedFolders={showOpenInCollapsedFolders}
                renamingId={renamingId}
                onFinishRename={onFinishRename}
                onToggleFolder={onToggleFolder}
                onOpenPin={onOpenPin}
                onUnloadPin={onUnloadPin}
                onResetPin={onResetPin}
                onToggleMute={onToggleMute}
                onDropOnParent={onDropOnParent}
                onPinContextMenu={onPinContextMenu}
                onFolderContextMenu={onFolderContextMenu}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // Pin item
  const live = node.tabId !== undefined ? tabs.get(node.tabId) : undefined;
  const isOpen = live !== undefined;
  const isPlaying = Boolean(live?.audible && !live.muted);
  const isMuted = Boolean(live?.muted);
  const isLoading = live?.status === 'loading';
  const navigatedAway = isOpen && live.url && live.url !== node.url;
  const dropClass =
    dropZone === 'before' ? 'drop-line-top' : dropZone === 'after' ? 'drop-line-bottom' : '';

  return (
    <li
      draggable={!isRenaming}
      style={{ opacity: draggingSelf ? 0.42 : 1 }}
      onDragStart={(e) => {
        e.stopPropagation();
        setDraggingSelf(true);
        e.dataTransfer.setData(
          DRAG_MIME,
          JSON.stringify({ kind: 'pin', id: node.id } satisfies DragPayload),
        );
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => {
        setDraggingSelf(false);
        setDropZone(null);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropZone(computeZone(e, false));
      }}
      onDragLeave={() => setDropZone(null)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const zone = dropZone ?? computeZone(e, false);
        setDropZone(null);
        setDraggingSelf(false);
        const payload = readDragPayload(e.dataTransfer);
        if (!payload) return;
        onDropOnParent(payload, parentId, zone === 'before' ? index : index + 1);
      }}
    >
      <div
        ref={rowRef}
        className={`group relative flex h-[36px] items-center gap-2 rounded-[10px] pr-2 transition-[background-color,box-shadow,transform] duration-100 ${
          isActivePin ? '' : 'hover:bg-[var(--hover)]'
        } ${dropClass}`}
        style={{
          paddingLeft,
          backgroundColor: isActivePin ? 'var(--pill)' : undefined,
          boxShadow: isActivePin ? 'var(--pill-shadow)' : undefined,
        }}
      >
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={() => onFinishRename(node.id, draftTitle)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onFinishRename(node.id, draftTitle);
              if (e.key === 'Escape') onFinishRename(node.id, null);
            }}
            className="w-full rounded-md px-1.5 py-0.5 text-[13.5px] outline-1 outline-[var(--accent)]"
            style={{ backgroundColor: 'var(--pill)', color: 'var(--ink)' }}
          />
        ) : (
          <>
            <button
              type="button"
              aria-current={isActivePin ? 'page' : undefined}
              title={
                live
                  ? `${node.title}${live.title && live.title !== node.title ? ` — ${live.title}` : ''}\n${live.url}`
                  : `${node.title}\n${node.url}`
              }
              onClick={() => onOpenPin(node.id)}
              onAuxClick={(e) => {
                if (e.button === 1 && isOpen) {
                  e.preventDefault();
                  onUnloadPin(node.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPinContextMenu(e, node);
              }}
              className="flex h-full min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
            >
              <span className="relative grid size-[18px] shrink-0 place-items-center">
                <Favicon
                  url={live?.url || node.url}
                  favIconUrl={live?.favIconUrl}
                  title={node.title}
                  size={16}
                />
                {isLoading && <span aria-hidden="true" className="arcline-loading-ring" />}
              </span>
              <span
                className="arcline-title-fade min-w-0 flex-1 text-[13.5px]"
                style={{
                  fontWeight: isActivePin ? 500 : 400,
                  opacity: isOpen ? 1 : 0.9,
                }}
              >
                {node.title}
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-0.5">
              {(isPlaying || isMuted) && node.tabId !== undefined && (
                <button
                  type="button"
                  title={isMuted ? t('sidebar.tab.unmute') : t('sidebar.tab.mute')}
                  aria-label={isMuted ? t('sidebar.tab.unmute') : t('sidebar.tab.mute')}
                  onClick={() => {
                    if (node.tabId !== undefined) onToggleMute(node.tabId);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--hover)] cursor-pointer"
                  style={{ color: 'var(--ink)' }}
                >
                  {isMuted ? (
                    <VolumeX size={13} />
                  ) : (
                    <span className="arcline-eq" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                </button>
              )}
              {navigatedAway && (
                <button
                  type="button"
                  title={t('sidebar.pinned.resetTitle')}
                  aria-label={t('sidebar.pinned.resetLabel')}
                  onClick={() => onResetPin(node.id)}
                  className="hidden h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--hover)] group-hover:flex cursor-pointer"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  <RotateCcw size={12} />
                </button>
              )}
              {isOpen && (
                <button
                  type="button"
                  title={t('sidebar.pinned.closeTabTitle')}
                  aria-label={t('sidebar.tab.close')}
                  onClick={() => onUnloadPin(node.id)}
                  className="hidden h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--hover)] group-hover:flex cursor-pointer"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  <Minus size={13} />
                </button>
              )}
              {isOpen && !isPlaying && !isMuted && (
                <span
                  aria-hidden="true"
                  className="mr-1 size-1.5 rounded-full group-hover:hidden"
                  style={{
                    backgroundColor: navigatedAway ? 'var(--accent)' : 'var(--ink-muted)',
                    opacity: isActivePin || navigatedAway ? 0.85 : 0.4,
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}
