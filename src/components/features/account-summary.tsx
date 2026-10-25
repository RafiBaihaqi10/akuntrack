import { GameMark, StatusChip } from "@/components/ui/badge";
import type { AccountRow } from "@/lib/db-types";
import { formatIdr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyUsername } from "./copy-username";

export type AccountLite = Pick<
  AccountRow,
  | "id"
  | "kode"
  | "username"
  | "game_singkatan"
  | "isi_akun"
  | "status"
  | "harga_beli_idr"
  | "store_id"
  | "sumber"
>;

/** Card identifying an account at the top of the sell and detail dialogs. */
export function AccountSummary({ account, className }: { account: AccountLite; className?: string }) {
  return (
    <section
      aria-label="Akun"
      className={cn("flex flex-col gap-2 rounded-xl bg-surface p-3.5 lg:bg-canvas", className)}
    >
      <div className="flex items-center gap-2.5">
        <GameMark abbr={account.game_singkatan} className="size-9" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-bold">{account.kode}</span>
          <span className="flex min-w-0 items-center text-xs text-ink-muted">
            <span className="truncate">{account.username ?? "username belum diisi"}</span>
            {account.username && <CopyUsername username={account.username} className="-my-3 -ml-1" />}
          </span>
        </span>
        <StatusChip status={account.status} />
      </div>
      <p className="line-clamp-2 text-base font-semibold lg:line-clamp-none">
        {account.isi_akun || "Belum ada isi"}
      </p>
      <p className="text-xs text-ink-muted">
        {account.sumber === "Grind" ? "Hasil grind, modal Rp0" : `Modal ${formatIdr(account.harga_beli_idr)}`}
      </p>
    </section>
  );
}
