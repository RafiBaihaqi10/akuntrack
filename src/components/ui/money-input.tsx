"use client";

import { useState, type ComponentProps } from "react";
import { parseIdrInput, parseUsdInput } from "@/lib/format";
import { AffixInput } from "./input";

type MoneyInputProps = Omit<
  ComponentProps<typeof AffixInput>,
  "value" | "defaultValue" | "onChange" | "prefix"
> & {
  currency: "usd" | "idr";
  value: number | null;
  onValueChange: (value: number | null) => void;
};

const idrGroup = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function toText(currency: "usd" | "idr", value: number | null) {
  if (value === null) return "";
  return currency === "idr" ? idrGroup.format(value) : String(value).replace(".", ",");
}

/**
 * Amount field: `$` (teal, comma or dot decimals) or `Rp` (whole rupiah,
 * grouped while typing). Emits a parsed number, or null when empty.
 */
export function MoneyInput({ currency, value, onValueChange, tone, ...props }: MoneyInputProps) {
  const [text, setText] = useState(() => toText(currency, value));
  const [lastValue, setLastValue] = useState(value);

  // Follow external value changes (e.g. form reset) without fighting the user's typing.
  if (value !== lastValue) {
    setLastValue(value);
    const parsedText = currency === "idr" ? parseIdrInput(text) : parseUsdInput(text);
    if (parsedText !== value) setText(toText(currency, value));
  }

  return (
    <AffixInput
      prefix={currency === "usd" ? "$" : "Rp"}
      tone={tone ?? (currency === "usd" ? "usd" : "default")}
      inputMode={currency === "usd" ? "decimal" : "numeric"}
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (currency === "idr") {
          const n = parseIdrInput(raw);
          setText(n === null ? "" : idrGroup.format(n));
          setLastValue(n);
          onValueChange(n);
        } else {
          const cleaned = raw.replace(/[^0-9.,]/g, "");
          const n = parseUsdInput(cleaned);
          setText(cleaned);
          setLastValue(n);
          onValueChange(n);
        }
      }}
      {...props}
    />
  );
}
