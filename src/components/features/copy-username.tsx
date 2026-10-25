"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Small copy-to-clipboard button for an account's username, used when logging
 * into the account. Shows a check for a moment after copying.
 */
export function CopyUsername({ username, className }: { username: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(e: React.MouseEvent) {
    // Rows open the detail on click; copying must not trigger that.
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(username);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); nothing useful to do.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Username tersalin" : `Salin username ${username}`}
      title={copied ? "Tersalin" : "Salin username"}
      className={cn(
        "inline-flex size-tap shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-track hover:text-ink",
        copied && "text-teal hover:text-teal",
        className,
      )}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </button>
  );
}
