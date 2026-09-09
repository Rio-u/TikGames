import { useCallback, useEffect, useState } from "react";
import {
  getAnalyticsSummary,
  getMyProducts,
  type AnalyticsSummary,
  type ProductAccess,
} from "./platformApi";

/** The signed-in creator's product catalog. Fetch-on-mount, same shape as useLiveSession /
 *  useDisabledGames so every consumer reads the same way. A failed fetch yields an empty list,
 *  never a thrown render — the shell must still be navigable if /products/me is down. */
export function useProducts() {
  const [products, setProducts] = useState<ProductAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProducts();
      setProducts(data.products);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل المنتجات");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { products, loading, error, refetch: load };
}

export function useAnalytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await getAnalyticsSummary());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحميل التحليلات");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, refetch: load };
}
