import { SquaresFour } from "@phosphor-icons/react";
import type { ProductCategory } from "@tikgames/shared-types";
import { DashboardShell } from "../components/DashboardShell";
import { EmptyState } from "../components/EmptyState";
import { ProductCard } from "../components/ProductCard";
import { SkeletonBlock } from "../components/StatTile";
import { useProducts } from "../lib/usePlatform";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  ENGAGEMENT: "تفاعل المشاهدين",
  OVERLAY: "عرض على الاستريم",
  INSIGHTS: "بيانات وتحليلات",
  AUTOMATION: "أتمتة",
};

/** Product discovery (§31). Available first, "قريباً" last — the ordering is the honesty: a
 *  creator scanning this page should hit everything that actually works before anything that
 *  doesn't. */
export default function Tools() {
  const { products, loading, error } = useProducts();

  const usable = products.filter((p) => p.status !== "COMING_SOON");
  const comingSoon = products.filter((p) => p.status === "COMING_SOON");

  const byCategory = new Map<ProductCategory, typeof usable>();
  for (const product of usable) {
    const bucket = byCategory.get(product.category) ?? [];
    bucket.push(product);
    byCategory.set(product.category, bucket);
  }

  return (
    <DashboardShell
      title="الأدوات"
      description="كل منتجات المنصة في مكان واحد. كل أداة بتشتغل على نفس جلسة اللايف ونفس أحداث المشاهدين، فتقدر تشغّل أكتر من واحدة على نفس البث."
    >
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonBlock key={i} className="h-60" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={SquaresFour}
          title="تعذّر تحميل الأدوات"
          description={error}
        />
      ) : (
        <div className="space-y-10">
          {[...byCategory.entries()].map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-4 text-sm font-semibold text-ink-muted">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}

          {comingSoon.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold text-ink-muted">قيد التطوير</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {comingSoon.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
