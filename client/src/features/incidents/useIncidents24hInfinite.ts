import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { itemsFromAnyPayload, type Incident } from "@/lib/incidentsShape";

const KEY = ["/api/incidents", { window: "24h" }];

function iso24hAgo() {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return d.toISOString();
}

export function useIncidents24hInfinite() {
  const qc = useQueryClient();
  
  // Seed from feed cache (fast first paint)
  const seed = useMemo(() => {
    const payload = qc.getQueryData(["/api/incidents"]);
    const initial = itemsFromAnyPayload(payload);
    const from = +new Date(iso24hAgo());
    return initial.filter(i => +new Date(i.createdAt) >= from);
  }, [qc]);

  return useInfiniteQuery({
    queryKey: KEY,
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("sinceHours", "24");
      params.set("page", pageParam.toString());

      const res = await fetch(`/api/incidents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load incidents 24h");
      const payload = await res.json();

      // Expected response: { incidents: Incident[], pagination: { page, limit, hasMore } }
      const items = itemsFromAnyPayload(payload);
      const hasMore = payload?.pagination?.hasMore || false;

      return { items, hasMore, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      // Stop if no more pages or if we've reached 24h limit
      if (!lastPage?.hasMore) return undefined;
      
      // Stop if the last item in the current page is older than 24h
      const oldestItem = lastPage.items[lastPage.items.length - 1];
      if (oldestItem && +new Date(oldestItem.createdAt) < +new Date(iso24hAgo())) {
        return undefined;
      }
      
      return lastPage.page + 1;
    },
    initialPageParam: 1,
    initialData: seed.length > 0 ? {
      pages: [{ items: seed, hasMore: true, page: 1 }],
      pageParams: [1],
    } : undefined,
    staleTime: 30_000,
  });
}