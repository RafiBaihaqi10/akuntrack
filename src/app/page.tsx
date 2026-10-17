import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";

// Temporary home until Beranda is built in the pages stage.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-gutter py-8">
      <PageHeader
        title="AkunTrack"
        subtitle="Login berhasil. Halaman Beranda dibangun di tahap berikutnya."
      />
      <Suspense fallback={<p className="text-sm text-ink-muted">Memuat akun…</p>}>
        <SignedInAs />
      </Suspense>
    </main>
  );
}

async function SignedInAs() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4.5">
      <p className="text-sm">
        Masuk sebagai <span className="font-bold">{user.email}</span>
      </p>
      <form action={signOut}>
        <Button type="submit">Keluar</Button>
      </form>
    </div>
  );
}
