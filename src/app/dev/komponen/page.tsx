import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Komponen · AkunTrack" };

/** Development-only gallery of the design tokens and base components. */
export default function KomponenPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
