import { Package } from "lucide-react";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk · AkunTrack" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-gutter py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-11 items-center justify-center rounded-md bg-ink text-gold">
            <Package className="size-5.5" strokeWidth={1.9} />
          </span>
          <span className="flex flex-col">
            <span className="text-md font-extrabold">AkunTrack</span>
            <span className="text-xs text-ink-muted">Pencatatan akun Zeron dan Realm</span>
          </span>
        </div>

        <section
          aria-labelledby="login-judul"
          className="flex flex-col gap-5 rounded-2xl bg-surface p-5 lg:p-6"
        >
          <div className="flex flex-col gap-0.5">
            <h1 id="login-judul" className="text-3xl font-extrabold tracking-tight">
              Masuk
            </h1>
            <p className="text-sm text-ink-muted">Pakai email dan password akun pemilik toko.</p>
          </div>
          <LoginForm />
        </section>

        <p className="text-center text-xs text-ink-muted">
          Belum punya akun? Akun dibuat lewat dashboard Supabase, pendaftaran publik ditutup.
        </p>
      </div>
    </main>
  );
}
