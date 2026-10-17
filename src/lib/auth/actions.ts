"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  error?: string;
  /** Echo the email back so the field is not cleared after an error. */
  email?: string;
};

const credentials = z.object({
  email: z.email("Format email belum benar"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "Email atau password salah"
        : error.code === "email_not_confirmed"
          ? "Email belum dikonfirmasi. Cek kotak masuk atau konfirmasi dari dashboard Supabase."
          : "Gagal masuk. Coba lagi sebentar lagi.";
    return { error: message, email };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
