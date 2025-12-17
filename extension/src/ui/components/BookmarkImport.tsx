import { FileUp, FolderOpen, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { importBookmarks, type ImportResult } from '@/lib/bookmark-import';

interface BookmarkImportProps {
  onImport: (result: ImportResult) => void;
  onCancel?: () => void;
}

export function BookmarkImport({ onImport, onCancel }: BookmarkImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setError(null);

      try {
        const content = await file.text();
        const result = importBookmarks(content);

        if (!result.success) {
          setError(result.error || 'Failed to parse bookmarks');
          return;
        }

        onImport(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read file');
      } finally {
        setIsProcessing(false);
      }
    },
    [onImport]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0]) {
        void processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        void processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Import Bookmarks</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <div
        className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label="Bookmark file drop zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,.json"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-slate-400">Processing bookmarks...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700/50">
              <Upload className="h-8 w-8 text-slate-400" />
            </div>

            <div className="space-y-2">
              <p className="text-base font-medium text-white">
                Drag & drop your bookmark file here
              </p>
              <p className="text-sm text-slate-400">or</p>
              <button
                type="button"
                onClick={handleBrowseClick}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                <FolderOpen className="h-4 w-4" />
                Browse Files
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-slate-800/50 p-4 space-y-3">
        <h4 className="text-sm font-medium text-white flex items-center gap-2">
          <FileUp className="h-4 w-4" />
          Supported Formats
        </h4>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>
              <strong className="text-slate-300">Netscape HTML</strong> - Chrome, Firefox, Safari,
              Edge exports
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>
              <strong className="text-slate-300">Arc Browser JSON</strong> - StorableSidebar.json
              from Arc
            </span>
          </li>
        </ul>

        <div className="pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-500">
            <strong>Arc Browser:</strong> Find your bookmarks at{' '}
            <code className="bg-slate-700 px-1 rounded">
              ~/Library/Application Support/Arc/StorableSidebar.json
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
