import { useQuery } from '@tanstack/react-query';
import { fetchPRComments } from '@/api/comments';
import { transformComments } from '@/lib/transforms';

export function useComments() {
  return useQuery({
    queryKey: ['pr-comments'],
    queryFn: ({ signal }) => fetchPRComments(signal).then(transformComments),
  });
}
