import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  generateAIReview,
  generateGrouping,
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
 * Feature flag for the SSE-streaming review path. Flip to `true` to route the
 * trigger button through `useStreamingReview` instead of the blocking JSON
 * mutation. Lives here so we can A/B in dev without env-var plumbing.
 */
export const STREAMING_REVIEW_ENABLED = false;

export function useAIReview() {
  const queryClient = useQueryClient();

  // useQuery subscribes to ['ai-review'] cache — re-renders when mutations write
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

  const reviewMutation = useMutation({
    mutationFn: (additionalContext?: string) => generateAIReview({ additionalContext }),
    mutationKey: ['ai-review'],
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-review'], {
        items: transformAIReviewItems(data.items),
        summary: data.summary,
      });
    },
  });

  const groupingMutation = useMutation({
    mutationFn: (additionalContext?: string) => generateGrouping(additionalContext),
    mutationKey: ['ai-grouping'],
    onSuccess: (data) => {
      queryClient.setQueryData(['ai-grouping'], transformChangeGroups(data));
    },
  });

  const triggerReview = async (additionalContext?: string): Promise<boolean> => {
    try {
      await reviewMutation.mutateAsync(additionalContext);
      return true;
    } catch {
      return false;
    }
  };

  const generateGroups = async (additionalContext?: string): Promise<boolean> => {
    try {
      await groupingMutation.mutateAsync(additionalContext);
      return true;
    } catch {
      return false;
    }
  };

  return {
    items: reviewData?.items ?? [],
    summary: reviewData?.summary ?? '',
    groups: groups ?? [],
    triggerReview,
    generateGroups,
    isLoading: reviewMutation.isPending,
    isGeneratingGroups: groupingMutation.isPending,
    error: reviewMutation.error ?? groupingMutation.error ?? null,
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

export type StreamingStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled';

interface StreamingReviewState {
  status: StreamingStatus;
  phase: StreamStatusPhase | null;
  thinking: string;
  text: string;
  toolCalls: StreamToolCall[];
  error: string | null;
}

const INITIAL_STREAMING_STATE: StreamingReviewState = {
  status: 'idle',
  phase: null,
  thinking: '',
  text: '',
  toolCalls: [],
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
      return { ...prev, thinking: appendThinking(prev.thinking, event.content, event.delta) };
    case 'text':
      return { ...prev, text: appendText(prev.text, event.content, event.delta) };
    case 'tool_use':
      return { ...prev, toolCalls: upsertToolUse(prev.toolCalls, event) };
    case 'tool_result':
      return { ...prev, toolCalls: applyToolResult(prev.toolCalls, event) };
    case 'result':
      queryClient.setQueryData(['ai-review'], {
        items: transformAIReviewItems(event.result.items),
        summary: event.result.summary,
      });
      return prev;
    case 'done':
      return { ...prev, status: 'done' };
    case 'error':
      return { ...prev, status: 'error', error: event.error };
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
  error: string | null;
}

const INITIAL_STREAMING_GROUPING_STATE: StreamingGroupingState = {
  status: 'idle',
  phase: null,
  thinking: '',
  text: '',
  toolCalls: [],
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
      return { ...prev, thinking: appendThinking(prev.thinking, event.content, event.delta) };
    case 'text':
      return { ...prev, text: appendText(prev.text, event.content, event.delta) };
    case 'tool_use':
      return { ...prev, toolCalls: upsertToolUse(prev.toolCalls, event) };
    case 'tool_result':
      return { ...prev, toolCalls: applyToolResult(prev.toolCalls, event) };
    case 'result':
      queryClient.setQueryData(['ai-grouping'], transformChangeGroups(event.result.groups));
      return prev;
    case 'done':
      return { ...prev, status: 'done' };
    case 'error':
      return { ...prev, status: 'error', error: event.error };
    case 'token_usage':
      return prev;
    default:
      return prev;
  }
}
