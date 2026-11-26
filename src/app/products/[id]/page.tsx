import { ProductScreen } from "@/components/product-screen";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">正在打开单品…</p>}>
      <ProductScreen />
    </Suspense>
  );
}
