import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type NutritionPage =
  | 'hub'
  | 'diary'
  | 'add'
  | 'food'
  | 'nutrients'
  | 'plan'
  | 'weight'
  | 'coach'
  | 'library'
  | 'reports'
  | 'check-in'
  | 'recipes';

const PAGES: NutritionPage[] = ['hub', 'diary', 'add', 'food', 'nutrients', 'plan', 'weight', 'coach', 'library', 'reports', 'check-in', 'recipes'];

export function pageFromPath(pathname: string): NutritionPage {
  const sub = pathname.replace(/^\/nutrition\/?/, '').split('/')[0];
  return (PAGES as string[]).includes(sub) ? (sub as NutritionPage) : 'hub';
}

/** Build a nutrition URL with query parameters (empty values are dropped). */
export function nutritionPath(page: NutritionPage, params?: Record<string, string | number | null | undefined>): string {
  const base = page === 'hub' ? '/nutrition' : `/nutrition/${page}`;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v != null && v !== '') search.set(k, String(v));
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export function useNutritionNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  return {
    params,
    go: (page: NutritionPage, query?: Record<string, string | number | null | undefined>) => navigate(nutritionPath(page, query)),
    replace: (page: NutritionPage, query?: Record<string, string | number | null | undefined>) =>
      navigate(nutritionPath(page, query), { replace: true }),
    goPath: (path: string) => navigate(path),
  };
}
