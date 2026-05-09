import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  streamAiReviewGuide,
  type ReviewGuideStreamEvent,
  type StreamStatusPhase,
} from '@/api/ai';
import { transformReviewGuide } from '@/lib/transforms';
import type { JudgmentThread, ReviewGuideState } from '@/types/review-guide';
import type { ReviewComment } from '@/types/review';
import { useDiffPanelContext } from '@/components/diff-panel/diff-panel-context';

export const REVIEW_GUIDE_QUERY_KEY = ['review-guide'] as const;

const EMPTY_STATE: ReviewGuideState = {
  guide: null,
  reviewedStepIds: [],
  currentStepId: null,
  threads: [],
};

/**
 * Cache reader for the review guide. Subscribers re-render whenever the
 * streaming hook or a mutator writes to `['review-guide']`.
 */
function useReviewGuideCache(): ReviewGuideState {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: REVIEW_GUIDE_QUERY_KEY,
    queryFn: () =>
      queryClient.getQueryData<ReviewGuideState>(REVIEW_GUIDE_QUERY_KEY) ?? EMPTY_STATE,
    staleTime: Infinity,
  });
  return data ?? EMPTY_STATE;
}

function readState(queryClient: QueryClient): ReviewGuideState {
  return queryClient.getQueryData<ReviewGuideState>(REVIEW_GUIDE_QUERY_KEY) ?? EMPTY_STATE;
}

function writeState(queryClient: QueryClient, next: ReviewGuideState): void {
  queryClient.setQueryData(REVIEW_GUIDE_QUERY_KEY, next);
}

function updateState(
  queryClient: QueryClient,
  updater: (prev: ReviewGuideState) => ReviewGuideState,
): void {
  writeState(queryClient, updater(readState(queryClient)));
}

// Streaming activity helpers — kept independent of `use-ai-review` to avoid
// pulling shared internals across hook boundaries; behavior matches the
// mirrored hooks there.

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

interface StreamingReviewGuideState {
  status: StreamingStatus;
  phase: StreamStatusPhase | null;
  thinking: string;
  text: string;
  toolCalls: StreamToolCall[];
  activities: StreamActivity[];
  error: string | null;
}

const INITIAL_STREAMING_STATE: StreamingReviewGuideState = {
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
  return prev.map((call) =>
    call.callId === event.callId
      ? { ...call, status: event.ok ? 'ok' : 'failed', preview: event.preview }
      : call,
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

/**
 * SSE-driven Review Guide hook. Mirror of `useStreamingGrouping` from
 * `use-ai-review`. On `result`, writes a fresh `ReviewGuideState` into
 * `['review-guide']` and preserves any threads currently marked `pinned` in
 * the prior cache value (regeneration semantics — origin R15/R18).
 */
export function useStreamingReviewGuide() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamingReviewGuideState>(INITIAL_STREAMING_STATE);
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
          setState((prev) => reduceReviewGuideEvent(prev, event, queryClient));
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

  return {
    status: state.status,
    phase: state.phase,
    thinking: state.thinking,
    text: state.text,
    toolCalls: state.toolCalls,
    activities: state.activities,
    error: state.error,
    start,
    cancel,
  };
}

function reduceReviewGuideEvent(
  prev: StreamingReviewGuideState,
  event: ReviewGuideStreamEvent,
  queryClient: QueryClient,
): StreamingReviewGuideState {
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
    case 'result': {
      const { guide, threads: newThreads } = transformReviewGuide(event.result);
      const previousState = readState(queryClient);
      const preservedPinned = previousState.threads.filter((t) => t.pinned);
      const preservedIds = new Set(preservedPinned.map((t) => t.id));
      // Newly emitted threads with an id colliding with a preserved pinned
      // thread are dropped — the pinned version wins.
      const dedupedNew = newThreads.filter((t) => !preservedIds.has(t.id));
      const next: ReviewGuideState = {
        guide,
        reviewedStepIds: [],
        currentStepId: guide.steps[0]?.id ?? null,
        threads: [...preservedPinned, ...dedupedNew],
      };
      writeState(queryClient, next);
      return prev;
    }
    case 'done':
      return { ...prev, status: 'done', activities: closeRunningThinking(prev.activities) };
    case 'error':
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

export interface RegenerationPreview {
  unresolvedDiscardedCount: number;
  pinnedPreservedThreads: JudgmentThread[];
}

export interface UseReviewGuideStateValue {
  state: ReviewGuideState;
  guide: ReviewGuideState['guide'];
  reviewedStepIds: string[];
  currentStepId: string | null;
  threads: JudgmentThread[];
  markStepReviewed: (stepId: string) => void;
  unmarkStepReviewed: (stepId: string) => void;
  setCurrentStep: (stepId: string) => void;
  pinThread: (threadId: string) => void;
  unpinThread: (threadId: string) => void;
  resolveThread: (threadId: string) => void;
  unresolveThread: (threadId: string) => void;
  replyToThread: (threadId: string, reply: ReviewComment) => void;
  prepareRegeneration: () => RegenerationPreview;
  reset: () => void;
}

/**
 * Reads `['review-guide']` and exposes mutators for stepper progress and
 * judgment-thread lifecycle. All mutators write atomically through
 * `queryClient.setQueryData` so subscribers re-render without prop drilling.
 */
export function useReviewGuideState(): UseReviewGuideStateValue {
  const queryClient = useQueryClient();
  const state = useReviewGuideCache();

  const markStepReviewed = useCallback(
    (stepId: string) => {
      updateState(queryClient, (prev) =>
        prev.reviewedStepIds.includes(stepId)
          ? prev
          : { ...prev, reviewedStepIds: [...prev.reviewedStepIds, stepId] },
      );
    },
    [queryClient],
  );

  const unmarkStepReviewed = useCallback(
    (stepId: string) => {
      updateState(queryClient, (prev) => ({
        ...prev,
        reviewedStepIds: prev.reviewedStepIds.filter((id) => id !== stepId),
      }));
    },
    [queryClient],
  );

  const setCurrentStep = useCallback(
    (stepId: string) => {
      updateState(queryClient, (prev) =>
        prev.currentStepId === stepId ? prev : { ...prev, currentStepId: stepId },
      );
    },
    [queryClient],
  );

  const updateThread = useCallback(
    (threadId: string, updater: (thread: JudgmentThread) => JudgmentThread) => {
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

  const prepareRegeneration = useCallback((): RegenerationPreview => {
    const current = readState(queryClient);
    const pinnedPreservedThreads = current.threads.filter((t) => t.pinned);
    const unresolvedDiscardedCount = current.threads.filter(
      (t) => !t.pinned && !t.resolved,
    ).length;
    return { unresolvedDiscardedCount, pinnedPreservedThreads };
  }, [queryClient]);

  const reset = useCallback(() => {
    writeState(queryClient, EMPTY_STATE);
  }, [queryClient]);

  return {
    state,
    guide: state.guide,
    reviewedStepIds: state.reviewedStepIds,
    currentStepId: state.currentStepId,
    threads: state.threads,
    markStepReviewed,
    unmarkStepReviewed,
    setCurrentStep,
    pinThread,
    unpinThread,
    resolveThread,
    unresolveThread,
    replyToThread,
    prepareRegeneration,
    reset,
  };
}

export interface UseOffRouteValue {
  isOffRoute: boolean;
  currentStepGroup: string[] | null;
}

/**
 * Off-route detection (R10): true when the diff viewer's selected file is not
 * a member of the current step's `fileGroup`. Derived from `useReviewGuideState`
 * + `useDiffPanelContext().selectedFilePath`; no stored mode in `DiffPanelContext`.
 */
export function useOffRoute(): UseOffRouteValue {
  const { guide, currentStepId } = useReviewGuideState();
  const { selectedFilePath } = useDiffPanelContext();

  return useMemo(() => {
    const currentStep = guide?.steps.find((s) => s.id === currentStepId) ?? null;
    const currentStepGroup = currentStep?.fileGroup ?? null;
    if (!currentStepGroup || currentStepGroup.length === 0 || !selectedFilePath) {
      return { isOffRoute: false, currentStepGroup };
    }
    return {
      isOffRoute: !currentStepGroup.includes(selectedFilePath),
      currentStepGroup,
    };
  }, [guide, currentStepId, selectedFilePath]);
}
