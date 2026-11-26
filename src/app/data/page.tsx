import { DataScreen } from "@/components/data-screen";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">正在打开数据工位…</p>}>
      <DataScreen />
    </Suspense>
  );
}
