"use client";

import { Toast as T } from "radix-ui";
import { createContext, use, useCallback, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastOptions = {
  title: ReactNode;
  description?: ReactNode;
  /** Optional action such as "Urungkan" (undo a status change). */
  action?: { label: string; onClick: () => void };
  tone?: "default" | "error";
};

type ToastItem = ToastOptions & { id: number };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

let nextId = 1;

/** Mount once near the root; then call `useToast()(…)` anywhere below. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((options: ToastOptions) => {
    setItems((current) => [...current, { ...options, id: nextId++ }]);
  }, []);

  const remove = (id: number) => setItems((current) => current.filter((t) => t.id !== id));

  return (
    <ToastContext value={show}>
      <T.Provider swipeDirection="down" duration={6000}>
        {children}
        {items.map((t) => (
          <T.Root
            key={t.id}
            onOpenChange={(open) => !open && remove(t.id)}
            className={cn(
              "flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-surface shadow-panel",
              t.tone === "error" && "bg-loss",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <T.Title className="text-base font-semibold">{t.title}</T.Title>
              {t.description && <T.Description className="text-xs opacity-80">{t.description}</T.Description>}
            </div>
            {t.action && (
              <T.Action
                altText={t.action.label}
                onClick={t.action.onClick}
                className="min-h-tap shrink-0 rounded-lg px-3 text-sm font-bold text-gold hover:bg-ink-tag"
              >
                {t.action.label}
              </T.Action>
            )}
          </T.Root>
        ))}
        <T.Viewport className="fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-gutter outline-none lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0 lg:px-0" />
      </T.Provider>
    </ToastContext>
  );
}

export function useToast() {
  const show = use(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
