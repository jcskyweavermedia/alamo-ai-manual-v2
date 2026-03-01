import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useBatchIngest } from '@/hooks/use-batch-ingest';
import { useIngestionSession } from '@/hooks/use-ingestion-session';
import { useDirectImageUpload } from '@/hooks/use-direct-image-upload';
import { useGenerateImage } from '@/hooks/use-generate-image';
import { useIsMobile } from '@/hooks/use-mobile';
import type { BeerLiquorDraft } from '@/types/ingestion';
import { createEmptyBeerLiquorDraft } from '@/types/ingestion';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Upload,
  FileText,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  CircleDot,
  AlertTriangle,
  Beer,
  Camera,
  X,
  Check,
  Save,
  Plus,
  ImageIcon,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type SortColumn = 'name' | 'category' | 'subcategory' | 'producer' | 'style' | 'status';
type SortDirection = 'asc' | 'desc';

interface UploadedFileInfo {
  id: string;
  name: string;
  type: 'file' | 'image';
  status: 'pending' | 'extracting' | 'done' | 'error';
  previewUrl?: string;
  charCount?: number;
  errorMessage?: string;
  extractedText?: string;   // file text content (stored after extraction)
  file?: File;              // original File object (for images, sent later)
}

interface DraftSessionInfo {
  id: string;
  itemCount: number;
  updatedAt: string;
}

// =============================================================================
// Props
// =============================================================================

interface BeerLiquorBatchIngestProps {
  onDirtyChange?: (dirty: boolean) => void;
}

// =============================================================================
// Component
// =============================================================================

export function BeerLiquorBatchIngest({ onDirtyChange }: BeerLiquorBatchIngestProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    extractBatch,
    extractFromFile,
    extractBatchVision,
    publishItems,
    isExtracting,
    isPublishing,
    publishProgress,
    error: hookError,
  } = useBatchIngest();

  const {
    createSession,
    saveDraft: saveSessionDraft,
    loadSession,
    listSessions,
    discardSession,
    completeSession,
  } = useIngestionSession();

  const { uploadToStorage } = useDirectImageUpload();
  const { generateImage } = useGenerateImage();

  // State
  const [isInputExpanded, setIsInputExpanded] = useState(true);
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<BeerLiquorDraft[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ published: number; failed: number } | null>(null);

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);

  // Draft persistence state
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftVersion, setDraftVersion] = useState(1);
  const [savedDraft, setSavedDraft] = useState<DraftSessionInfo | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Image cell state — which item is currently uploading/generating
  const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);

  // Table container ref for fixed scrollbar sync
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Check for existing draft sessions on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessions = await listSessions('drafting');
      if (cancelled) return;
      const beerDrafts = sessions.filter((s) => s.productTable === 'beer_liquor_list');
      if (beerDrafts.length > 0) {
        const latest = beerDrafts[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const draftData = latest.draftData as any;
        const itemCount = draftData?.items?.length ?? 0;
        setSavedDraft({
          id: latest.id,
          itemCount,
          updatedAt: latest.updatedAt,
        });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeUploadedFile = useCallback((id: string) => {
    setUploadedFiles((prev) => {
      const entry = prev.find((f) => f.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  // Mark dirty whenever items or selection changes
  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Per-item publish callback (avoids in-place mutation of React state)
  // ---------------------------------------------------------------------------
  const handleItemPublished = useCallback(
    (tempId: string, status: 'published' | 'error', errorMessage?: string) => {
      setItems((prev) =>
        prev.map((i) =>
          i._tempId === tempId
            ? { ...i, rowStatus: status, errorMessage: errorMessage ?? i.errorMessage }
            : i,
        ),
      );
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Save Draft
  // ---------------------------------------------------------------------------
  const handleSaveDraft = useCallback(async () => {
    if (items.length === 0) return;

    setIsSaving(true);
    try {
      let sid = sessionId;
      if (!sid) {
        sid = await createSession('beer_liquor_list', 'batch');
        if (!sid) throw new Error('Failed to create session');
        setSessionId(sid);
      }

      const draftPayload = {
        items,
        rawText,
        selectedIds: [...selectedIds],
      };

      const ok = await saveSessionDraft(draftPayload as never, draftVersion);
      if (ok) {
        setDraftVersion((v) => v + 1);
        setIsDirty(false);
        toast({ title: 'Draft saved', description: `${items.length} items saved` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Save failed', description: msg });
    } finally {
      setIsSaving(false);
    }
  }, [items, rawText, selectedIds, sessionId, draftVersion, createSession, saveSessionDraft, toast]);

  // ---------------------------------------------------------------------------
  // Resume Draft
  // ---------------------------------------------------------------------------
  const handleResumeDraft = useCallback(async () => {
    if (!savedDraft) return;

    const result = await loadSession(savedDraft.id);
    if (!result) {
      toast({ title: 'Failed to load draft' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draftData = result.session.draftData as any;
    if (draftData?.items) {
      setItems(draftData.items);
      setRawText(draftData.rawText ?? '');
      setSelectedIds(new Set(draftData.selectedIds ?? []));
      setSessionId(savedDraft.id);
      setDraftVersion(result.session.draftVersion);
      setIsInputExpanded(false);
      setIsDirty(false);
      setSavedDraft(null);
      toast({ title: 'Draft resumed', description: `${draftData.items.length} items restored` });
    }
  }, [savedDraft, loadSession, toast]);

  // ---------------------------------------------------------------------------
  // Discard Draft
  // ---------------------------------------------------------------------------
  const handleDiscardDraft = useCallback(async () => {
    if (!savedDraft) return;
    await discardSession(savedDraft.id);
    setSavedDraft(null);
    toast({ title: 'Draft discarded' });
  }, [savedDraft, discardSession, toast]);

  // ---------------------------------------------------------------------------
  // Clear All with unsaved changes guard
  // ---------------------------------------------------------------------------
  const resetToEmpty = useCallback(() => {
    setItems([]);
    setSelectedIds(new Set());
    setRawText('');
    setUploadedFiles([]);
    setIsInputExpanded(true);
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const handleClearAll = useCallback(() => {
    if (isDirty) {
      setShowClearDialog(true);
    } else {
      resetToEmpty();
    }
  }, [isDirty, resetToEmpty]);

  const handleSaveThenClear = useCallback(async () => {
    setIsSaving(true);
    try {
      let sid = sessionId;
      if (!sid) {
        sid = await createSession('beer_liquor_list', 'batch');
        if (!sid) throw new Error('Failed to create session');
        setSessionId(sid);
      }

      const draftPayload = { items, rawText, selectedIds: [...selectedIds] };
      const ok = await saveSessionDraft(draftPayload as never, draftVersion);
      if (ok) {
        setDraftVersion((v) => v + 1);
        setShowClearDialog(false);
        resetToEmpty();
        toast({ title: 'Draft saved, items cleared' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({ title: 'Save failed', description: msg });
    } finally {
      setIsSaving(false);
    }
  }, [items, rawText, selectedIds, sessionId, draftVersion, createSession, saveSessionDraft, toast, resetToEmpty]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleExtract = useCallback(async () => {
    // Collect all text: rawText + extracted text from file thumbnails
    const textParts: string[] = [];
    if (rawText.trim()) textParts.push(rawText.trim());
    for (const f of uploadedFiles) {
      if (f.extractedText) textParts.push(f.extractedText);
    }
    const combinedText = textParts.join('\n\n');

    // Collect all queued image File objects
    const imageFiles = uploadedFiles
      .filter((f) => f.type === 'image' && f.file)
      .map((f) => f.file!);

    if (!combinedText && imageFiles.length === 0) {
      toast({ title: 'Empty input', description: 'Paste text, upload files, or add images first' });
      return;
    }

    let result: Awaited<ReturnType<typeof extractBatch>>;

    if (imageFiles.length > 0) {
      // Has images → use vision path (handles images + text together)
      // Mark image thumbnails as extracting
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.type === 'image' && f.file
            ? { ...f, status: 'extracting' as const }
            : f,
        ),
      );

      result = await extractBatchVision(imageFiles, combinedText || undefined, sessionId ?? undefined);

      // Update image thumbnails to done/error
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.type === 'image' && f.file
            ? { ...f, status: result ? 'done' as const : 'error' as const }
            : f,
        ),
      );
    } else {
      // Text only → use existing text-based extraction
      result = await extractBatch(combinedText, sessionId ?? undefined);
    }

    if (!result) {
      toast({ title: 'Extraction failed', description: 'Check the error below and try again' });
      return;
    }

    setSessionId(result.sessionId);
    setItems(prev => [...prev, ...result.items]);
    setSelectedIds(prev => {
      const next = new Set(prev);
      result.items.filter((i) => i.rowStatus === 'pending').forEach(i => next.add(i._tempId));
      return next;
    });
    setIsInputExpanded(false);
    setIsDirty(true);

    toast({
      title: `${result.totalExtracted} items extracted`,
      description: result.duplicates > 0
        ? `${result.duplicates} potential duplicate(s) detected`
        : result.message,
    });
  }, [rawText, uploadedFiles, sessionId, extractBatch, extractBatchVision, toast]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Create entries with 'pending' status
    const entries: UploadedFileInfo[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      type: 'file' as const,
      status: 'pending' as const,
    }));
    setUploadedFiles((prev) => [...prev, ...entries]);

    let successCount = 0;
    let totalChars = 0;

    // Extract text from each file sequentially — does NOT block buttons
    for (let i = 0; i < files.length; i++) {
      const entryId = entries[i].id;
      setUploadedFiles((prev) =>
        prev.map((uf) => (uf.id === entryId ? { ...uf, status: 'extracting' } : uf)),
      );

      const text = await extractFromFile(files[i]);
      if (text) {
        successCount++;
        totalChars += text.length;
        // Store extracted text on the entry (NOT appended to rawText)
        setUploadedFiles((prev) =>
          prev.map((uf) => (uf.id === entryId ? { ...uf, status: 'done', charCount: text.length, extractedText: text } : uf)),
        );
      } else {
        setUploadedFiles((prev) =>
          prev.map((uf) => (uf.id === entryId ? { ...uf, status: 'error', errorMessage: 'Could not extract text' } : uf)),
        );
      }
    }

    if (files.length > 1) {
      toast({
        title: `${successCount}/${files.length} files extracted`,
        description: `${totalChars.toLocaleString()} characters queued`,
      });
    } else if (successCount === 1) {
      toast({ title: 'File queued', description: `${files[0].name} — ${totalChars} characters` });
    } else {
      toast({ title: 'Extraction failed', description: 'Could not extract text from file.' });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [extractFromFile, toast]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Instant queue — images are "done" (queued and ready). No AI call yet.
    // The File objects are stored on the entries for later use by handleExtract.
    const entries: UploadedFileInfo[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      type: 'image' as const,
      status: 'done' as const,
      previewUrl: URL.createObjectURL(f),
      file: f,
    }));
    setUploadedFiles((prev) => [...prev, ...entries]);

    toast({
      title: `${files.length} image${files.length !== 1 ? 's' : ''} queued`,
      description: 'Click "Extract Items" to process everything together',
    });

    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [toast]);

  const handlePublishSelected = useCallback(async () => {
    const toPublish = items.filter(
      (i) => selectedIds.has(i._tempId) && i.rowStatus === 'pending',
    );
    if (toPublish.length === 0) {
      toast({ title: 'Nothing to publish', description: 'Select items with "Ready" status' });
      return;
    }

    const result = await publishItems(toPublish, sessionId, handleItemPublished);
    setPublishResult(result);
    setIsDirty(false);

    // Mark session as published if all items are done
    if (sessionId && result.failed === 0) {
      await completeSession(sessionId);
    }

    toast({
      title: 'Publish complete',
      description: `Published ${result.published} item(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
    });
  }, [items, selectedIds, sessionId, publishItems, handleItemPublished, completeSession, toast]);

  const handlePublishAll = useCallback(async () => {
    const toPublish = items.filter((i) => i.rowStatus === 'pending');
    if (toPublish.length === 0) {
      toast({ title: 'Nothing to publish', description: 'No items with "Ready" status' });
      return;
    }

    const result = await publishItems(toPublish, sessionId, handleItemPublished);
    setPublishResult(result);
    setIsDirty(false);

    // Mark session as published if all items are done
    if (sessionId && result.failed === 0) {
      await completeSession(sessionId);
    }

    toast({
      title: 'Publish complete',
      description: `Published ${result.published} item(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
    });
  }, [items, sessionId, publishItems, handleItemPublished, completeSession, toast]);

  const handleDeleteItem = useCallback((tempId: string) => {
    setItems((prev) => prev.filter((i) => i._tempId !== tempId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
    if (expandedId === tempId) setExpandedId(null);
    markDirty();
  }, [expandedId, markDirty]);

  const handleAddBlankRow = useCallback(() => {
    const blank = createEmptyBeerLiquorDraft();
    setItems(prev => [...prev, blank]);
    markDirty();
  }, [markDirty]);

  const updateItem = useCallback((tempId: string, updates: Partial<BeerLiquorDraft>) => {
    setItems((prev) =>
      prev.map((i) => (i._tempId === tempId ? { ...i, ...updates } : i)),
    );
    markDirty();
  }, [markDirty]);

  const toggleSelect = useCallback((tempId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
    markDirty();
  }, [markDirty]);

  const toggleSelectAll = useCallback(() => {
    const pendingIds = items.filter((i) => i.rowStatus === 'pending').map((i) => i._tempId);
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of pendingIds) next.delete(id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of pendingIds) next.add(id);
        return next;
      });
    }
    markDirty();
  }, [items, selectedIds, markDirty]);

  // ---------------------------------------------------------------------------
  // Image cell handlers
  // ---------------------------------------------------------------------------

  const handleImageCellUpload = useCallback(async (tempId: string, file: File) => {
    setImageLoadingId(tempId);
    const url = await uploadToStorage(file, sessionId ?? undefined);
    if (url) {
      updateItem(tempId, { image: url });
    }
    setImageLoadingId(null);
  }, [sessionId, uploadToStorage, updateItem]);

  const handleImageCellGenerate = useCallback(async (tempId: string, item: BeerLiquorDraft) => {
    setImageLoadingId(tempId);
    const result = await generateImage({
      productTable: 'beer_liquor_list',
      name: item.name,
      prepType: item.category,
      description: item.description,
      sessionId: sessionId ?? undefined,
    });
    if (result) {
      updateItem(tempId, { image: result.imageUrl });
    }
    setImageLoadingId(null);
  }, [sessionId, generateImage, updateItem]);

  const handleImageCellClear = useCallback((tempId: string) => {
    updateItem(tempId, { image: null });
  }, [updateItem]);

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  const sortedItems = useMemo(() => {
    if (!sortColumn) return items;

    const statusOrder: Record<string, number> = {
      pending: 0,
      duplicate_skipped: 1,
      error: 2,
      published: 3,
    };

    return [...items].sort((a, b) => {
      let aVal: string;
      let bVal: string;

      if (sortColumn === 'status') {
        const diff = (statusOrder[a.rowStatus] ?? 9) - (statusOrder[b.rowStatus] ?? 9);
        return sortDirection === 'asc' ? diff : -diff;
      }

      aVal = (a[sortColumn] ?? '').toLowerCase();
      bVal = (b[sortColumn] ?? '').toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [items, sortColumn, sortDirection]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const pendingCount = items.filter((i) => i.rowStatus === 'pending').length;
  const selectedPendingCount = items.filter(
    (i) => selectedIds.has(i._tempId) && i.rowStatus === 'pending',
  ).length;
  const duplicateCount = items.filter((i) => i.rowStatus === 'duplicate_skipped').length;
  const publishedCount = items.filter((i) => i.rowStatus === 'published').length;
  const isProcessingFiles = uploadedFiles.some((f) => f.type === 'file' && (f.status === 'pending' || f.status === 'extracting'));
  const hasContent = rawText.trim()
    || uploadedFiles.some((f) => f.extractedText)
    || uploadedFiles.some((f) => f.type === 'image' && f.file);
  const isBusy = isExtracting;
  const allDone = publishResult && !isPublishing;

  // Auto-expand input when there are no items
  useEffect(() => {
    if (items.length === 0) {
      setIsInputExpanded(true);
    }
  }, [items.length]);

  // Forward horizontal wheel/trackpad events to scrollLeft
  // (since overflow-x is hidden on the table container)
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Handle trackpad/shift+wheel horizontal scrolling
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
        el.scrollLeft += e.deltaX;
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [items.length]);

  // ---------------------------------------------------------------------------
  // Unified Layout (Collapsible Input + Item Table)
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Beer className="h-5 w-5 text-orange-500" />
          Beer & Liquor — Batch Ingest
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Queue everything first — paste text, upload files, snap photos — then click Extract Items to send it all to AI together.
        </p>
      </div>

      {/* Resume Draft banner */}
      {savedDraft && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <RotateCcw className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
              You have a saved draft ({savedDraft.itemCount} items)
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Last updated {new Date(savedDraft.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResumeDraft}
            className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/50"
          >
            Resume Draft
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscardDraft}
            className="text-blue-600 hover:text-destructive"
          >
            Discard
          </Button>
        </div>
      )}

      {/* Collapsible Input Section */}
      <Collapsible open={isInputExpanded} onOpenChange={setIsInputExpanded}>
        <div className="flex items-center justify-between mb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", !isInputExpanded && "-rotate-90")} />
              <span className="text-sm font-medium">
                {isInputExpanded ? 'Input' : `Input · ${items.length} items extracted`}
              </span>
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="space-y-4">
            <Textarea
              placeholder="Paste items or type instructions here...&#10;&#10;You can also upload files and images — everything gets sent to AI together.&#10;&#10;Examples:&#10;These are from our Texas craft beer distributor:&#10;Shiner Bock, Lone Pint Yellow Rose IPA"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              rows={12}
            />

            {uploadedFiles.length > 0 && (
              <FileThumbnailStrip files={uploadedFiles} onRemove={removeUploadedFile} />
            )}

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy || isPublishing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>

              {/* Hidden image file input */}
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => imageInputRef.current?.click()}
                disabled={isBusy || isPublishing}
              >
                <Camera className="h-4 w-4 mr-2" />
                Upload Images
              </Button>

              <div className="flex-1" />

              <Button
                onClick={handleExtract}
                disabled={isBusy || isPublishing || !hasContent}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                {isProcessingFiles ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reading files...
                  </>
                ) : isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting items...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Extract Items
                  </>
                )}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Hook error display */}
      {hookError && (
        <p className="text-sm text-destructive">{hookError}</p>
      )}

      {/* Publishing progress bar */}
      {isPublishing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Publishing {publishProgress.done} of {publishProgress.total}...
          </div>
          <Progress
            value={publishProgress.total > 0
              ? (publishProgress.done / publishProgress.total) * 100
              : 0
            }
          />
        </div>
      )}

      {/* Completion message */}
      {allDone && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm">
            Published {publishResult.published} item{publishResult.published !== 1 ? 's' : ''}
            {publishResult.failed > 0 && `, ${publishResult.failed} failed`}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => navigate('/beer-liquor')}
          >
            View Beer & Liquor List
          </Button>
        </div>
      )}

      {/* Item Table */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </h3>
              {duplicateCount > 0 && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {duplicateCount} potential duplicate{duplicateCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {publishedCount > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {publishedCount} published
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              {/* Clear All */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={isPublishing || isExtracting || items.length === 0}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Clear All
              </Button>

              {/* Save Draft */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isPublishing || isSaving || items.length === 0}
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                {isSaving ? 'Saving...' : 'Save Draft'}
                {isDirty && !isSaving && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                disabled={isPublishing || isExtracting || pendingCount === 0}
              >
                {selectedPendingCount === pendingCount && pendingCount > 0 ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePublishSelected}
                disabled={isPublishing || isExtracting || selectedPendingCount === 0}
              >
                Publish Selected ({selectedPendingCount})
              </Button>
              <Button
                size="sm"
                onClick={handlePublishAll}
                disabled={isPublishing || isExtracting || pendingCount === 0}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                Publish All ({pendingCount})
              </Button>
            </div>
          </div>

          {/* Table — vertical scroll only; horizontal handled by fixed scrollbar */}
          <div
            ref={tableContainerRef}
            className="border rounded-lg flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          >

            <TooltipProvider>
              <Table className="min-w-[1120px]">
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-10" />
                    <SortableHead column="name" label="Name" current={sortColumn} direction={sortDirection} onSort={handleSort} className="min-w-[240px]" />
                    <TableHead className="w-[70px]">
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-muted-foreground">Image</span>
                        <span className="text-[9px] text-muted-foreground/60 leading-none">(optional)</span>
                      </div>
                    </TableHead>
                    <SortableHead column="category" label="Category" current={sortColumn} direction={sortDirection} onSort={handleSort} className="w-[100px]" />
                    <SortableHead column="subcategory" label="Subcategory" current={sortColumn} direction={sortDirection} onSort={handleSort} className="min-w-[130px]" />
                    <SortableHead column="producer" label="Producer" current={sortColumn} direction={sortDirection} onSort={handleSort} className="min-w-[180px]" />
                    <SortableHead column="style" label="Style" current={sortColumn} direction={sortDirection} onSort={handleSort} className="min-w-[140px]" />
                    <SortableHead column="status" label="Status" current={sortColumn} direction={sortDirection} onSort={handleSort} className="w-[80px] text-center" />
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => {
                    const isExpanded = expandedId === item._tempId;
                    const isSelected = selectedIds.has(item._tempId);
                    const isPending = item.rowStatus === 'pending';
                    const isItemPublished = item.rowStatus === 'published';
                    const isError = item.rowStatus === 'error';

                    return (
                      <TableRowGroup key={item._tempId}>
                        {/* Main row */}
                        <TableRow
                          className={cn(
                            'cursor-pointer',
                            isItemPublished && 'bg-green-50/50 dark:bg-green-950/10',
                            isError && 'bg-red-50/50 dark:bg-red-950/10',
                          )}
                          onClick={() => setExpandedId(isExpanded ? null : item._tempId)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(item._tempId)}
                              disabled={!isPending}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-1.5">
                              <span className="mt-1 shrink-0">
                                {isExpanded
                                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                }
                              </span>
                              <InlineNameInput
                                value={item.name}
                                onChange={(v) => updateItem(item._tempId, { name: v })}
                                disabled={isItemPublished}
                              />
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <ImageThumbnailCell
                              item={item}
                              isLoading={imageLoadingId === item._tempId}
                              isDisabled={isItemPublished}
                              onUpload={(file) => handleImageCellUpload(item._tempId, file)}
                              onGenerate={() => handleImageCellGenerate(item._tempId, item)}
                              onClear={() => handleImageCellClear(item._tempId)}
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={item.category}
                              onValueChange={(v) => updateItem(item._tempId, { category: v as 'Beer' | 'Liquor' })}
                              disabled={isItemPublished}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Beer">Beer</SelectItem>
                                <SelectItem value="Liquor">Liquor</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <InlineInput
                              value={item.subcategory}
                              onChange={(v) => updateItem(item._tempId, { subcategory: v })}
                              disabled={isItemPublished}
                              placeholder="Subcategory"
                              ariaLabel="Subcategory"
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <InlineInput
                              value={item.producer}
                              onChange={(v) => updateItem(item._tempId, { producer: v })}
                              disabled={isItemPublished}
                              placeholder="Producer"
                              ariaLabel="Producer"
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <InlineInput
                              value={item.style}
                              onChange={(v) => updateItem(item._tempId, { style: v })}
                              disabled={isItemPublished}
                              placeholder="Style"
                              ariaLabel="Style"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge item={item} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {!isItemPublished && (
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item._tempId)}
                                disabled={isPublishing || isExtracting}
                                className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Remove item"
                                aria-label={`Remove ${item.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded row */}
                        {isExpanded && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={9} className="py-3 px-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Country</label>
                                  <Input
                                    value={item.country}
                                    onChange={(e) => updateItem(item._tempId, { country: e.target.value })}
                                    disabled={isItemPublished}
                                    className="mt-1 h-8 text-sm"
                                    placeholder="Country of origin"
                                  />
                                </div>
                                <div className="flex items-center gap-2 self-end">
                                  <Checkbox
                                    id={`featured-${item._tempId}`}
                                    checked={item.isFeatured}
                                    onCheckedChange={(v) => updateItem(item._tempId, { isFeatured: !!v })}
                                    disabled={isItemPublished}
                                  />
                                  <label htmlFor={`featured-${item._tempId}`} className="text-sm">
                                    Featured item
                                  </label>
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                                  <Textarea
                                    value={item.description}
                                    onChange={(e) => updateItem(item._tempId, { description: e.target.value })}
                                    disabled={isItemPublished}
                                    className="mt-1 text-sm"
                                    rows={3}
                                    placeholder="Product description"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                                  <Textarea
                                    value={item.notes}
                                    onChange={(e) => updateItem(item._tempId, { notes: e.target.value })}
                                    disabled={isItemPublished}
                                    className="mt-1 text-sm"
                                    rows={3}
                                    placeholder="Tasting notes, service temp, pairings"
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableRowGroup>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>

          {/* Fixed horizontal scrollbar — always at viewport bottom */}
          <StickyScrollbar containerRef={tableContainerRef} />

          {/* Add Blank Row */}
          <button
            type="button"
            onClick={handleAddBlankRow}
            disabled={isPublishing}
            className={cn(
              "flex items-center gap-1.5 w-full justify-center",
              "py-2.5 mt-1 rounded-lg border border-dashed border-border flex-shrink-0",
              "text-sm text-muted-foreground",
              "hover:bg-muted/50 hover:text-foreground hover:border-foreground/20",
              "transition-colors",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add blank row</span>
          </button>
        </div>
      )}

      {/* Clear All confirmation dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all items?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. This will discard all extracted items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSaveThenClear();
              }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Draft First'}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setShowClearDialog(false);
                resetToEmpty();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

/** Wrapper fragment for grouping main row + expanded row */
function TableRowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Sortable column header */
function SortableHead({
  column,
  label,
  current,
  direction,
  onSort,
  className,
}: {
  column: SortColumn;
  label: string;
  current: SortColumn | null;
  direction: SortDirection;
  onSort: (col: SortColumn) => void;
  className?: string;
}) {
  const isActive = current === column;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        {isActive ? (
          direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

/** Inline editable input (compact, borderless until focus) */
function InlineInput({
  value,
  onChange,
  disabled,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      className={cn(
        'w-full bg-transparent border-0 border-b border-transparent',
        'focus:border-orange-300 focus:outline-none focus:ring-0',
        'text-sm py-0.5 px-0 transition-colors',
        'disabled:opacity-60',
        className,
      )}
    />
  );
}

/** Inline name input — shows 2-line text normally, textarea on focus */
function InlineNameInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (editing && !disabled) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onClick={(e) => e.stopPropagation()}
        rows={2}
        className={cn(
          'w-full bg-transparent border-0 border-b border-orange-300',
          'focus:outline-none focus:ring-0',
          'text-sm font-medium py-0.5 px-0 resize-none leading-snug',
        )}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) setEditing(true);
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
        }
      }}
      className={cn(
        'text-sm font-medium leading-snug line-clamp-2 min-w-0',
        'border-b border-transparent cursor-text',
        'hover:border-muted-foreground/30 transition-colors',
        disabled && 'opacity-60 cursor-default',
        !value && 'text-muted-foreground italic',
      )}
    >
      {value || 'Untitled'}
    </span>
  );
}

/** Image thumbnail cell with upload/generate popover */
function ImageThumbnailCell({
  item,
  isLoading,
  isDisabled,
  onUpload,
  onGenerate,
  onClear,
}: {
  item: BeerLiquorDraft;
  isLoading: boolean;
  isDisabled: boolean;
  onUpload: (file: File) => void;
  onGenerate: () => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="h-10 w-10 rounded-md bg-muted/60 flex items-center justify-center mx-auto">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (item.image) {
    return (
      <div className="group relative h-10 w-10 rounded-md overflow-hidden mx-auto">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {!isDisabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-background border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
            aria-label="Remove image"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    );
  }

  if (isDisabled) {
    return <div className="h-10 w-10" />;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-10 w-10 rounded-md border border-dashed border-muted-foreground/30 flex items-center justify-center mx-auto hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors"
          aria-label="Add image"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground/50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="center" side="bottom">
        <button
          type="button"
          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          Upload Photo
        </button>
        <button
          type="button"
          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
          onClick={onGenerate}
        >
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Generate with AI
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Horizontal scrollable strip of file/image thumbnails with status indicators */
function FileThumbnailStrip({
  files,
  onRemove,
}: {
  files: UploadedFileInfo[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto py-2 px-1">
      {files.map((f) => {
        const borderColor =
          f.status === 'extracting'
            ? 'border-orange-400'
            : f.status === 'done'
              ? 'border-green-400'
              : f.status === 'error'
                ? 'border-red-400'
                : 'border-muted';

        const ext = f.name.split('.').pop()?.toUpperCase() ?? '';

        return (
          <div key={f.id} className="group relative flex flex-col items-center shrink-0 w-16">
            {/* Thumbnail */}
            <div
              className={cn(
                'relative h-14 w-14 rounded-lg border-2 overflow-hidden flex items-center justify-center bg-muted/40',
                borderColor,
              )}
            >
              {f.type === 'image' && f.previewUrl ? (
                <img
                  src={f.previewUrl}
                  alt={f.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[9px] font-bold text-muted-foreground leading-none">
                    {ext}
                  </span>
                </div>
              )}

              {/* Status overlay */}
              {f.status === 'extracting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                </div>
              )}
              {f.status === 'done' && (
                <div className="absolute bottom-0 right-0 bg-green-500 rounded-tl-md rounded-br-md p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              {f.status === 'error' && (
                <div className="absolute bottom-0 right-0 bg-red-500 rounded-tl-md rounded-br-md p-0.5">
                  <AlertCircle className="h-3 w-3 text-white" />
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Filename */}
            <span className="mt-1 text-[10px] text-muted-foreground text-center truncate w-full leading-tight" title={f.name}>
              {f.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Status badge with tooltip for duplicates/errors */
function StatusBadge({ item }: { item: BeerLiquorDraft }) {
  switch (item.rowStatus) {
    case 'pending':
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <CircleDot className="h-3 w-3 text-gray-400" />
          Ready
        </Badge>
      );
    case 'duplicate_skipped':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs gap-1 text-yellow-600 border-yellow-300 cursor-help">
              <AlertTriangle className="h-3 w-3" />
              Dup?
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Existing: "{item.duplicateOf?.name}"
          </TooltipContent>
        </Tooltip>
      );
    case 'published':
      return (
        <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-300">
          <CheckCircle2 className="h-3 w-3" />
          Done
        </Badge>
      );
    case 'error':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-xs gap-1 text-red-600 border-red-300 cursor-help">
              <AlertCircle className="h-3 w-3" />
              Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {item.errorMessage || 'Unknown error'}
          </TooltipContent>
        </Tooltip>
      );
    default:
      return null;
  }
}

/** Fixed horizontal scrollbar — position:fixed at viewport bottom, synced with table container */
function StickyScrollbar({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const [dims, setDims] = useState({ scrollWidth: 0, clientWidth: 0, left: 0, width: 0 });

  // Measure table container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setDims({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        left: rect.left,
        width: rect.width,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [containerRef]);

  // Sync: fixed scrollbar → table container
  const handleScroll = useCallback(() => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    if (containerRef.current && scrollRef.current) {
      containerRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, [containerRef]);

  // Sync: table container → fixed scrollbar
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTableScroll = () => {
      if (isSyncing.current) return;
      isSyncing.current = true;
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = el.scrollLeft;
      }
      requestAnimationFrame(() => { isSyncing.current = false; });
    };

    el.addEventListener('scroll', onTableScroll, { passive: true });
    return () => el.removeEventListener('scroll', onTableScroll);
  }, [containerRef]);

  // Don't render if no horizontal overflow
  if (dims.scrollWidth <= dims.clientWidth) return null;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="fixed z-50 overflow-x-auto"
      style={{
        bottom: isMobile ? 96 : 8,
        left: dims.left,
        width: dims.width,
        height: 14,
      }}
    >
      <div style={{ width: dims.scrollWidth, height: 1 }} />
    </div>
  );
}
