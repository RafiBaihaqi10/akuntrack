import { Suspense } from "react";
import { AppFrame } from "@/components/app/app-frame";
import { KursBox, KursBoxSkeleton } from "@/components/app/kurs-box";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppFrame
      kurs={
        <Suspense fallback={<KursBoxSkeleton />}>
          <KursBox />
        </Suspense>
      }
    >
      {children}
    </AppFrame>
  );
}
