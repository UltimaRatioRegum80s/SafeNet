export type Incident = {
  id: string;
  title: string;
  createdAt: string;
  lat: number;
  lng: number;
  type: string;
  severity: string;
  description?: string;
  latitude?: string | number;
  longitude?: string | number;
  isOptimistic?: boolean; // True for optimistic/pending incidents before server confirmation
  userId?: string | null; // Reporter user ID (may be absent for anonymous reports)
};

type Paginated<T> = { items: T[]; incidents?: T[]; total?: number; nextCursor?: string };

export function itemsFromAnyPayload(payload: any): Incident[] {
  if (Array.isArray(payload)) return payload as Incident[];
  if (payload && Array.isArray((payload as Paginated<Incident>).items)) {
    return (payload as Paginated<Incident>).items;
  }
  if (payload && Array.isArray((payload as Paginated<Incident>).incidents)) {
    return (payload as Paginated<Incident>).incidents || [];
  }
  return [];
}