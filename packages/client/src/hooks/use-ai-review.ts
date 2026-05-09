import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  streamAiGrouping,
  streamAiReview,
  type GroupingStreamEvent,
  type ReviewStreamEvent,
  type StreamStatusPhase,
} from '@/api/ai';
import { transformAIReviewItems, transformChangeGroups } from '@/lib/transforms';
import type { AIReviewItem } from '@/types/review';
import type { ChangeGroup } from '@/types/grouping';

interface ReviewCache {
  items: AIReviewItem[];
  summary: string;
}

const EMPTY_REVIEW: ReviewCache = { items: [], summary: '' };

/**
 * Cache reader for AI review items + grouping results.
 *
 * Both surfaces are written exclusively by the streaming hooks below
 * (`useStreamingReview` / `useStreamingGrouping`); this hook only subscribes
 * so consumers re-render when those caches update.
 */
export function useAIReview() {
  const queryClient = useQueryClient();

  // useQuery subscribes to ['ai-review'] cache — re-renders when streams write
  const { data: reviewData } = useQuery({
    queryKey: ['ai-review' as const],
    queryFn: () => {
      const cached = queryClient.getQueryData<ReviewCache>(['ai-review']);
      return cached ?? EMPTY_REVIEW;
    },
    staleTime: Infinity,
  });

  // useQuery subscribes to ['ai-grouping'] cache
  const { data: groups } = useQuery({
    queryKey: ['ai-grouping' as const],
    queryFn: () => {
      const cached = queryClient.getQueryData<ChangeGroup[]>(['ai-grouping']);
      return cached ?? [];
    },
    staleTime: Infinity,
  });

  return {
    items: reviewData?.items ?? [],
    summary: reviewData?.summary ?? '',
    groups: groups ?? [],
  };
}

/** Per-call tool invocation surfaced to the UI. */
export interface StreamToolCall {
  callId: string;
  toolName: string;
  input?: unknown;
  status: 'pending' | 'ok' | 'failed';
  preview?: string;
}

/**
 * Chronologically ordered timeline entry. Thinking deltas collapse into a
 * single thinking block until a tool call (or stream end) closes it; each
 * tool_use produces its own row that updates in place when the matching
 * tool_result arrives. This mirrors how Claude Code surfaces "what the agent
 * is doing right now" in its TurnCard, but stays purpose-built for our
 * one-shot review/grouping streams.
 */
export type StreamActivity =
  | {
      kind: 'thinking';
      id: string;
      content: string;
      status: 'running' | 'completed';
    }
  | {
      kind: 'tool';
      id: string; // mirrors callId
      toolName: string;
      input?: unknown;
      status: 'pending' | 'ok' | 'failed';
      preview?: string;
    };

export type StreamingStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled';

interface StreamingReviewState {
  status: StreamingStatus;
  phase: StreamStatusPhase | null;
  thinking: string;
  text: string;
  toolCalls: StreamToolCall[];
  activities: StreamActivity[];
  error: string | null;
}

const INITIAL_STREAMING_STATE: StreamingReviewState = {
  status: 'idle',
  phase: null,
  thinking: '',
  text: '',
  toolCalls: [],
  activities: [],
  error: null,
};

function appendThinking(prev: string, content: string, delta?: boolean): string {
  return delta || prev.length === 0 ? prev + content : content;
}

function appendText(prev: string, content: string, delta?: boolean): string {
  return delta || prev.length === 0 ? prev + content : content;
}

function upsertToolUse(prev: StreamToolCall[], event: {
  callId: string;
  toolName: string;
  input?: unknown;
}): StreamToolCall[] {
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

/** Mark every running thinking block as completed — used on tool_use and stream end. */
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
  // Merge delta into the trailing running thinking block; otherwise start a new one.
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
  // A new tool call ends any running thinking block — they're sequential on the agent loop.
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
 * SSE-driven review hook. Exposes live `phase`, `thinking`, `toolCalls`, and
 * (on completion) writes the parsed result into the same `['ai-review']`
 * cache the blocking `useAIReview` hook reads from, so downstream components
 * keep working unchanged.
 *
 * `start(additionalContext)` opens the stream. `cancel()` aborts it. The hook
 * also aborts on unmount to avoid orphaning a fetch reader.
 */
export function useStreamingReview() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamingReviewState>(INITIAL_STREAMING_STATE);
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
        const stream = streamAiReview(
          additionalContext ? { additionalContext } : {},
          { signal: controller.signal },
        );
        for await (const event of stream) {
          if (controller.signal.aborted) return false;
          setState((prev) => reduceReviewEvent(prev, event, queryClient));
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

function reduceReviewEvent(
  prev: StreamingReviewState,
  event: ReviewStreamEvent,
  queryClient: ReturnType<typeof useQueryClient>,
): StreamingReviewState {
  switch (event.type) {
    case 'status':
      return { ...prev, phase: event.phase };
    case 'thinking':
      return {
        ...prev,
        thinking: appendThinking(prev.thinking, event.content, event.delta),
        activities: appendThinkingActivity(prev.activities, event.content, event.delta),
      };
    case 'text':
      return { ...prev, text: appendText(prev.text, event.content, event.delta) };
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
    case 'result':
      queryClient.setQueryData(['ai-review'], {
        items: transformAIReviewItems(event.result.items),
        summary: event.result.summary,
      });
      return prev;
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

interface StreamingGroupingState {
  status: StreamingStatus;
  phase: StreamStatusPhase | null;
  thinking: string;
  text: string;
  toolCalls: StreamToolCall[];
  activities: StreamActivity[];
  error: string | null;
}

const INITIAL_STREAMING_GROUPING_STATE: StreamingGroupingState = {
  status: 'idle',
  phase: null,
  thinking: '',
  text: '',
  toolCalls: [],
  activities: [],
  error: null,
};

/**
 * SSE-driven grouping hook, mirror of {@link useStreamingReview}. Writes the
 * parsed groups into the same `['ai-grouping']` cache the blocking
 * `useAIReview` hook reads from.
 */
export function useStreamingGrouping() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<StreamingGroupingState>(INITIAL_STREAMING_GROUPING_STATE);
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
      setState({ ...INITIAL_STREAMING_GROUPING_STATE, status: 'streaming' });

      try {
        const stream = streamAiGrouping(
          additionalContext ? { additionalContext } : {},
          { signal: controller.signal },
        );
        for await (const event of stream) {
          if (controller.signal.aborted) return false;
          setState((prev) => reduceGroupingEvent(prev, event, queryClient));
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

function reduceGroupingEvent(
  prev: StreamingGroupingState,
  event: GroupingStreamEvent,
  queryClient: ReturnType<typeof useQueryClient>,
): StreamingGroupingState {
  switch (event.type) {
    case 'status':
      return { ...prev, phase: event.phase };
    case 'thinking':
      return {
        ...prev,
        thinking: appendThinking(prev.thinking, event.content, event.delta),
        activities: appendThinkingActivity(prev.activities, event.content, event.delta),
      };
    case 'text':
      return { ...prev, text: appendText(prev.text, event.content, event.delta) };
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
    case 'result':
      queryClient.setQueryData(['ai-grouping'], transformChangeGroups(event.result.groups));
      return prev;
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
