import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  streamAiReviewGuide,
  streamAiNotebookChapter,
  type ChapterRegenerationRequestBody,
  type NotebookChapterErrorEvent,
  type NotebookChapterEvent,
  type NotebookOutlineEvent,
  type ReviewGuideStreamEvent,
  type StreamStatusPhase,
} from '@/api/ai';
import {
  transformNotebookCells,
  transformNotebookJudgmentThreads,
  transformNotebookOutline,
} from '@/lib/transforms';
import type {
  ChapterStatus,
  NotebookChapter,
  NotebookChapterState,
  NotebookCompletionState,
  NotebookJudgmentThread,
  NotebookOrphanThread,
  NotebookState,
} from '@/types/review-guide';
import type { ReviewComment } from '@/types/review';

export const REVIEW_GUIDE_QUERY_KEY = ['review-guide'] as const;

const EMPTY_COMPLETION: NotebookCompletionState = {
  acknowledgedNoteIds: [],
  checkedChecklistItemIds: [],
};

const EMPTY_STATE: NotebookState = {
  overview: '',
  chapters: [],
  threads: [],
  orphans: [],
  completion: EMPTY_COMPLETION,
};

// --- Cache helpers --------------------------------------------------------

function readState(queryClient: QueryClient): NotebookState {
  return (
    queryClient.getQueryData<NotebookState>(REVIEW_GUIDE_QUERY_KEY) ?? EMPTY_STATE
  );
}

function writeState(queryClient: QueryClient, next: NotebookState): void {
  queryClient.setQueryData(REVIEW_GUIDE_QUERY_KEY, next);
}

function updateState(
  queryClient: QueryClient,
  updater: (prev: NotebookState) => NotebookState,
): void {
  writeState(queryClient, updater(readState(queryClient)));
}

function useNotebookCache(): NotebookState {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: REVIEW_GUIDE_QUERY_KEY,
    queryFn: () => readState(queryClient),
    staleTime: Infinity,
  });
  return data ?? EMPTY_STATE;
}

// --- Stream activity types & helpers --------------------------------------

interface StreamToolCall {
  callId: string;
  toolName: string;
  input?: unknown;
  status: 'pending' | 'ok' | 'failed';
  preview?: string;
}

type StreamActivity =
  | { kind: 'thinking'; id: string; content: string; status: 'running' | 'completed' }
  | {
      kind: 'tool';
      id: string;
      toolName: string;
      input?: unknown;
      status: 'pending' | 'ok' | 'failed';
      preview?: string;
    };

type StreamingStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled';

interface StreamingNotebookState {
  status: StreamingStatus;
  phase: StreamStatusPhase | null;
  thinking: string;
  text: string;
  toolCalls: StreamToolCall[];
  activities: StreamActivity[];
  error: string | null;
}

const INITIAL_STREAMING_STATE: StreamingNotebookState = {
  status: 'idle',
  phase: null,
  thinking: '',
  text: '',
  toolCalls: [],
  activities: [],
  error: null,
};

function appendDelta(prev: string, content: string, delta?: boolean): string {
  return delta || prev.length === 0 ? prev + content : content;
}

function upsertToolUse(
  prev: StreamToolCall[],
  event: { callId: string; toolName: string; input?: unknown },
): StreamToolCall[] {
  if (prev.some((c) => c.callId === event.callId)) return prev;
  return [
    ...prev,
    { callId: event.callId, toolName: event.toolName, input: event.input, status: 'pending' },
  ];
}

function applyToolResult(
  prev: StreamToolCall[],
  event: { callId: string; ok: boolean; preview?: string },
): StreamToolCall[] {
  return prev.map((c) =>
    c.callId === event.callId
      ? { ...c, status: event.ok ? 'ok' : 'failed', preview: event.preview }
      : c,
  );
}

function closeRunningThinking(activities: StreamActivity[]): StreamActivity[] {
  let mutated = false;
  const next = activities.map((a) => {
    if (a.kind === 'thinking' && a.status === 'running') {
      mutated = true;
      return { ...a, status: 'completed' as const };
    }
    return a;
  });
  return mutated ? next : activities;
}

function appendThinkingActivity(
  prev: StreamActivity[],
  content: string,
  delta: boolean | undefined,
): StreamActivity[] {
  const last = prev[prev.length - 1];
  if (last?.kind === 'thinking' && last.status === 'running') {
    const nextContent = delta ? last.content + content : content;
    return [...prev.slice(0, -1), { ...last, content: nextContent }];
  }
  return [
    ...prev,
    { kind: 'thinking', id: `think-${prev.length}-${Date.now()}`, content, status: 'running' },
  ];
}

function appendToolActivity(
  prev: StreamActivity[],
  event: { callId: string; toolName: string; input?: unknown },
): StreamActivity[] {
  if (prev.some((a) => a.kind === 'tool' && a.id === event.callId)) return prev;
  const closed = closeRunningThinking(prev);
  return [
    ...closed,
    {
      kind: 'tool',
      id: event.callId,
      toolName: event.toolName,
      input: event.input,
      status: 'pending',
    },
  ];
}

function applyToolResultActivity(
  prev: StreamActivity[],
  event: { callId: string; ok: boolean; preview?: string },
): StreamActivity[] {
  return prev.map((a) =>
    a.kind === 'tool' && a.id === event.callId
      ? { ...a, status: event.ok ? 'ok' : 'failed', preview: event.preview }
      : a,
  );
}

// --- Notebook cache reducers ----------------------------------------------

/**
 * Apply a `notebook_outline` event: create chapter shells in `pending` state,
 * or replace existing shells while preserving lifecycle/completion state for
 * chapter ids that survive (full regeneration scope).
 */
function applyOutlineEvent(
  queryClient: QueryClient,
  event: NotebookOutlineEvent,
  scope: 'full' | 'partial',
): void {
  updateState(queryClient, (prev) => {
    const newOutline: NotebookChapter[] = transformNotebookOutline(event.outline);

    if (scope === 'full') {
      // Full notebook generation — clear chapters/cells/completion.
      // Preserve pinned threads (per regeneration policy) — they will either
      // be re-anchored when their chapter content arrives or archived to the
      // orphan list during applyChapterEvent reconciliation.
      const chapters: NotebookChapterState[] = newOutline.map((chapter) => ({
        chapter,
        status: 'generating',
        cells: [],
      }));
      const preservedPinned = prev.threads.filter((t) => t.pinned);
      return {
        ...prev,
        overview: event.overview,
        chapters,
        completion: EMPTY_COMPLETION,
        threads: preservedPinned,
      };
    }

    // Partial: outline event came mid-stream after some chapters existed —
    // merge by chapter id, preserving any chapter we already have content for.
    const previousById = new Map(prev.chapters.map((c) => [c.chapter.id, c]));
    const chapters: NotebookChapterState[] = newOutline.map((chapter) => {
      const existing = previousById.get(chapter.id);
      if (existing) return { ...existing, chapter };
      return { chapter, status: 'generating', cells: [] };
    });
    return { ...prev, overview: event.overview, chapters };
  });
}

/**
 * Apply a `notebook_chapter` event: fill in the cells for the matching
 * chapter shell, mark it `complete`, and reconcile its judgment threads.
 *
 * Reconciliation rules per the plan's regeneration policy:
 *   - Threads with a prior id that match an incoming thread keep client-only
 *     state (pinned/resolved/replies).
 *   - Threads pinned in the prior cache that survive by anchor (filePath +
 *     side + lineNumber) are kept inline.
 *   - Threads pinned in the prior cache whose anchor no longer matches any
 *     incoming thread are moved to the flat orphan archive with their
 *     originating chapterId and an archivedAt timestamp.
 *   - Unpinned threads from the prior cache for this chapter are discarded.
 */
function applyChapterEvent(queryClient: QueryClient, event: NotebookChapterEvent): void {
  const cells = transformNotebookCells(event.cells);
  const incoming = transformNotebookJudgmentThreads(event.judgmentThreads);
  const now = new Date();

  updateState(queryClient, (prev) => {
    const chapterIndex = prev.chapters.findIndex(
      (c) => c.chapter.id === event.chapterId,
    );
    let chapters: NotebookChapterState[];
    if (chapterIndex === -1) {
      // Chapter not in outline — create a placeholder and append.
      chapters = [
        ...prev.chapters,
        {
          chapter: { id: event.chapterId, title: 'Unlinked chapter', intent: '' },
          status: 'partial',
          cells,
        },
      ];
    } else {
      chapters = prev.chapters.slice();
      const existing = chapters[chapterIndex]!;
      chapters[chapterIndex] = {
        ...existing,
        status: 'complete',
        cells,
        error: undefined,
      };
    }

    // Partition prior threads into "scoped to this chapter" and "other".
    const otherThreads: NotebookJudgmentThread[] = [];
    const priorChapterThreads: NotebookJudgmentThread[] = [];
    for (const thread of prev.threads) {
      if (thread.chapterId === event.chapterId) priorChapterThreads.push(thread);
      else otherThreads.push(thread);
    }

    // Reconcile prior chapter threads with incoming threads:
    //   match by id first; fall back to anchor (filePath/side/lineNumber).
    const incomingById = new Map(incoming.map((t) => [t.id, t]));
    const incomingAnchorKey = (t: NotebookJudgmentThread) =>
      `${t.filePath}::${t.side}::${t.lineNumber}`;
    const incomingByAnchor = new Map(
      incoming.map((t) => [incomingAnchorKey(t), t]),
    );

    const reconciledChapter: NotebookJudgmentThread[] = [];
    const consumedIncoming = new Set<string>();
    const newlyArchived: NotebookOrphanThread[] = [];

    for (const prior of priorChapterThreads) {
      const byId = incomingById.get(prior.id);
      const byAnchor = incomingByAnchor.get(incomingAnchorKey(prior));
      const match = byId ?? byAnchor;

      if (match) {
        consumedIncoming.add(match.id);
        reconciledChapter.push({
          ...match,
          pinned: prior.pinned,
          resolved: prior.resolved,
          replies: prior.replies,
          createdAt: prior.createdAt,
        });
        continue;
      }

      // No match — discard unpinned threads, archive pinned ones.
      if (prior.pinned) {
        newlyArchived.push({
          thread: prior,
          originChapterId: event.chapterId,
          archivedAt: now,
        });
      }
    }

    for (const fresh of incoming) {
      if (consumedIncoming.has(fresh.id)) continue;
      reconciledChapter.push(fresh);
    }

    const threads = [...otherThreads, ...reconciledChapter];
    const orphans = [...prev.orphans, ...newlyArchived];

    return { ...prev, chapters, threads, orphans };
  });
}

function applyChapterErrorEvent(
  queryClient: QueryClient,
  event: NotebookChapterErrorEvent,
): void {
  updateState(queryClient, (prev) => {
    const chapters = prev.chapters.map((c) =>
      c.chapter.id === event.chapterId
        ? ({ ...c, status: 'error' as ChapterStatus, error: event.error })
        : c,
    );
    return { ...prev, chapters };
  });
}

// --- Streaming hook -------------------------------------------------------

/**
 * SSE-driven Notebook hook. Drives the full-notebook generation stream and a
 * scoped per-chapter regeneration stream. Both write into the same
 * `['review-guide']` cache, scoped via the `scope` flag of `start*`.
 */
export function useStreamingReviewGuide() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamingNotebookState>(INITIAL_STREAMING_STATE);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
      setState((prev) =>
        prev.status === 'streaming' ? { ...prev, status: 'cancelled' } : prev,
      );
    }
  }, []);

  const start = useCallback(
    async (additionalContext?: string): Promise<boolean> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ ...INITIAL_STREAMING_STATE, status: 'streaming' });

      try {
        const stream = streamAiReviewGuide(
          additionalContext ? { additionalContext } : {},
          { signal: controller.signal },
        );
        for await (const event of stream) {
          if (controller.signal.aborted) return false;
          setState((prev) => reduceStreamEvent(prev, event, queryClient, 'full'));
          if (event.type === 'done' || event.type === 'error') {
            controllerRef.current = null;
            return event.type === 'done';
          }
        }
        controllerRef.current = null;
        return true;
      } catch (error) {
        if (controller.signal.aborted) return false;
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ ...prev, status: 'error', error: message }));
        controllerRef.current = null;
        return false;
      }
    },
    [queryClient],
  );

  const startChapter = useCallback(
    async (body: ChapterRegenerationRequestBody): Promise<boolean> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ ...INITIAL_STREAMING_STATE, status: 'streaming' });

      // Mark the target chapter as generating before the stream begins so the
      // UI can show per-chapter progress.
      updateState(queryClient, (prev) => ({
        ...prev,
        chapters: prev.chapters.map((c) =>
          c.chapter.id === body.chapterId
            ? { ...c, status: 'generating', error: undefined }
            : c,
        ),
      }));

      try {
        const stream = streamAiNotebookChapter(body, { signal: controller.signal });
        for await (const event of stream) {
          if (controller.signal.aborted) return false;
          setState((prev) => reduceStreamEvent(prev, event, queryClient, 'partial'));
          if (event.type === 'done' || event.type === 'error') {
            controllerRef.current = null;
            return event.type === 'done';
          }
        }
        controllerRef.current = null;
        return true;
      } catch (error) {
        if (controller.signal.aborted) return false;
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({ ...prev, status: 'error', error: message }));
        applyChapterErrorEvent(queryClient, {
          type: 'notebook_chapter_error',
          chapterId: body.chapterId,
          error: message,
        });
        controllerRef.current = null;
        return false;
      }
    },
    [queryClient],
  );

  return {
    status: state.status,
    phase: state.phase,
    thinking: state.thinking,
    text: state.text,
    toolCalls: state.toolCalls,
    activities: state.activities,
    error: state.error,
    start,
    startChapter,
    cancel,
  };
}

function reduceStreamEvent(
  prev: StreamingNotebookState,
  event: ReviewGuideStreamEvent,
  queryClient: QueryClient,
  scope: 'full' | 'partial',
): StreamingNotebookState {
  switch (event.type) {
    case 'status':
      return { ...prev, phase: event.phase };
    case 'thinking':
      return {
        ...prev,
        thinking: appendDelta(prev.thinking, event.content, event.delta),
        activities: appendThinkingActivity(prev.activities, event.content, event.delta),
      };
    case 'text':
      return { ...prev, text: appendDelta(prev.text, event.content, event.delta) };
    case 'tool_use':
      return {
        ...prev,
        toolCalls: upsertToolUse(prev.toolCalls, event),
        activities: appendToolActivity(prev.activities, event),
      };
    case 'tool_result':
      return {
        ...prev,
        toolCalls: applyToolResult(prev.toolCalls, event),
        activities: applyToolResultActivity(prev.activities, event),
      };
    case 'notebook_outline':
      applyOutlineEvent(queryClient, event, scope);
      return prev;
    case 'notebook_chapter':
      applyChapterEvent(queryClient, event);
      return prev;
    case 'notebook_chapter_error':
      applyChapterErrorEvent(queryClient, event);
      return prev;
    case 'done':
      // After the terminal `done`, mark any chapter still in `generating`
      // state as `partial` (incomplete data). This satisfies "terminal stream
      // error after one complete chapter retains that chapter and marks
      // later chapters partial". Also archive any pinned thread whose
      // chapterId is no longer in the outline (full-regeneration orphan path).
      updateState(queryClient, (state) => {
        const validChapterIds = new Set(state.chapters.map((c) => c.chapter.id));
        const survivingThreads: NotebookJudgmentThread[] = [];
        const newOrphans: NotebookOrphanThread[] = [];
        const archivedAt = new Date();
        for (const thread of state.threads) {
          if (validChapterIds.has(thread.chapterId)) {
            survivingThreads.push(thread);
          } else if (thread.pinned) {
            newOrphans.push({
              thread,
              originChapterId: thread.chapterId,
              archivedAt,
            });
          }
        }
        return {
          ...state,
          chapters: state.chapters.map((c) =>
            c.status === 'generating' ? { ...c, status: 'partial' } : c,
          ),
          threads: survivingThreads,
          orphans: [...state.orphans, ...newOrphans],
        };
      });
      return { ...prev, status: 'done', activities: closeRunningThinking(prev.activities) };
    case 'error':
      updateState(queryClient, (state) => ({
        ...state,
        chapters: state.chapters.map((c) =>
          c.status === 'generating' ? { ...c, status: 'partial' } : c,
        ),
      }));
      return {
        ...prev,
        status: 'error',
        error: event.error,
        activities: closeRunningThinking(prev.activities),
      };
    case 'token_usage':
      return prev;
    default:
      return prev;
  }
}

// --- Mutator hook ---------------------------------------------------------

export interface RegenerationPreview {
  unresolvedDiscardedCount: number;
  pinnedPreservedThreads: NotebookJudgmentThread[];
}

export interface NotebookCompletionDerived {
  isNoteAcknowledged: (cellId: string) => boolean;
  isChecklistItemChecked: (key: string) => boolean;
}

export interface UseReviewGuideStateValue {
  state: NotebookState;
  overview: string;
  chapters: NotebookChapterState[];
  threads: NotebookJudgmentThread[];
  orphans: NotebookOrphanThread[];
  completion: NotebookCompletionState;
  derived: NotebookCompletionDerived;

  // Cell completion mutators
  acknowledgeNote: (cellId: string) => void;
  unacknowledgeNote: (cellId: string) => void;
  toggleChecklistItem: (cellId: string, itemId: string) => void;

  // Thread lifecycle mutators
  pinThread: (threadId: string) => void;
  unpinThread: (threadId: string) => void;
  resolveThread: (threadId: string) => void;
  unresolveThread: (threadId: string) => void;
  replyToThread: (threadId: string, reply: ReviewComment) => void;

  // Regeneration preparation
  prepareFullRegeneration: () => RegenerationPreview;
  prepareChapterRegeneration: (chapterId: string) => RegenerationPreview;
  reset: () => void;
}

function checklistKey(cellId: string, itemId: string): string {
  return `${cellId}::${itemId}`;
}

function addToList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list : [...list, value];
}

function removeFromList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : list;
}

/**
 * Reads `['review-guide']` and exposes Notebook mutators (cell completion,
 * checklist, ack, diff expand, thread lifecycle, regeneration preparation).
 * All mutators write atomically through `queryClient.setQueryData`.
 */
export function useReviewGuideState(): UseReviewGuideStateValue {
  const queryClient = useQueryClient();
  const state = useNotebookCache();

  const acknowledgeNote = useCallback(
    (cellId: string) => {
      updateState(queryClient, (prev) => ({
        ...prev,
        completion: {
          ...prev.completion,
          acknowledgedNoteIds: addToList(prev.completion.acknowledgedNoteIds, cellId),
        },
      }));
    },
    [queryClient],
  );

  const unacknowledgeNote = useCallback(
    (cellId: string) => {
      updateState(queryClient, (prev) => ({
        ...prev,
        completion: {
          ...prev.completion,
          acknowledgedNoteIds: removeFromList(
            prev.completion.acknowledgedNoteIds,
            cellId,
          ),
        },
      }));
    },
    [queryClient],
  );

  const toggleChecklistItem = useCallback(
    (cellId: string, itemId: string) => {
      const key = checklistKey(cellId, itemId);
      updateState(queryClient, (prev) => {
        const list = prev.completion.checkedChecklistItemIds;
        const next = list.includes(key)
          ? removeFromList(list, key)
          : addToList(list, key);
        return {
          ...prev,
          completion: { ...prev.completion, checkedChecklistItemIds: next },
        };
      });
    },
    [queryClient],
  );

  const updateThread = useCallback(
    (threadId: string, updater: (t: NotebookJudgmentThread) => NotebookJudgmentThread) => {
      updateState(queryClient, (prev) => ({
        ...prev,
        threads: prev.threads.map((t) => (t.id === threadId ? updater(t) : t)),
      }));
    },
    [queryClient],
  );

  const pinThread = useCallback(
    (threadId: string) => updateThread(threadId, (t) => ({ ...t, pinned: true })),
    [updateThread],
  );
  const unpinThread = useCallback(
    (threadId: string) => updateThread(threadId, (t) => ({ ...t, pinned: false })),
    [updateThread],
  );
  const resolveThread = useCallback(
    (threadId: string) => updateThread(threadId, (t) => ({ ...t, resolved: true })),
    [updateThread],
  );
  const unresolveThread = useCallback(
    (threadId: string) => updateThread(threadId, (t) => ({ ...t, resolved: false })),
    [updateThread],
  );
  const replyToThread = useCallback(
    (threadId: string, reply: ReviewComment) =>
      updateThread(threadId, (t) => ({ ...t, replies: [...t.replies, reply] })),
    [updateThread],
  );

  const prepareFullRegeneration = useCallback((): RegenerationPreview => {
    const current = readState(queryClient);
    const pinnedPreservedThreads = current.threads.filter((t) => t.pinned);
    const unresolvedDiscardedCount = current.threads.filter(
      (t) => !t.pinned && !t.resolved,
    ).length;
    return { unresolvedDiscardedCount, pinnedPreservedThreads };
  }, [queryClient]);

  const prepareChapterRegeneration = useCallback(
    (chapterId: string): RegenerationPreview => {
      const current = readState(queryClient);
      const scoped = current.threads.filter((t) => t.chapterId === chapterId);
      const pinnedPreservedThreads = scoped.filter((t) => t.pinned);
      const unresolvedDiscardedCount = scoped.filter(
        (t) => !t.pinned && !t.resolved,
      ).length;
      return { unresolvedDiscardedCount, pinnedPreservedThreads };
    },
    [queryClient],
  );

  const reset = useCallback(() => {
    writeState(queryClient, EMPTY_STATE);
  }, [queryClient]);

  const derived: NotebookCompletionDerived = {
    isNoteAcknowledged: (id) => state.completion.acknowledgedNoteIds.includes(id),
    isChecklistItemChecked: (key) =>
      state.completion.checkedChecklistItemIds.includes(key),
  };

  return {
    state,
    overview: state.overview,
    chapters: state.chapters,
    threads: state.threads,
    orphans: state.orphans,
    completion: state.completion,
    derived,
    acknowledgeNote,
    unacknowledgeNote,
    toggleChecklistItem,
    pinThread,
    unpinThread,
    resolveThread,
    unresolveThread,
    replyToThread,
    prepareFullRegeneration,
    prepareChapterRegeneration,
    reset,
  };
}

export { checklistKey };
