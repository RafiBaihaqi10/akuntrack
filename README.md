# AkunTrack

Pencatatan stok, penjualan (USD), dan balance toko akun game. Next.js + TypeScript + Tailwind + Supabase.

## Menjalankan

1. `cp .env.example .env.local` lalu isi URL dan publishable key Supabase.
2. `npm install`
3. `npm run dev`

Skrip lain: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`.

Migration database ada di `supabase/migrations/` dan dijalankan manual setelah direview.
Referensi visual: `design/UI.html`.
