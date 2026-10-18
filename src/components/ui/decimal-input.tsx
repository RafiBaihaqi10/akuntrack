"use client";

import { useState, type ComponentProps } from "react";
import { parseUsdInput } from "@/lib/format";
import { AffixInput } from "./input";

type DecimalInputProps = Omit<ComponentProps<typeof AffixInput>, "value" | "defaultValue" | "onChange"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Whole numbers only (days, rupiah thresholds). */
  integer?: boolean;
};

const intFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

function toText(value: number | null, integer?: boolean) {
  if (value === null) return "";
  return integer ? intFormat.format(value) : String(value).replace(".", ",");
}

/** Plain number field with an affix (`%`, `hari`, `Rp`); accepts comma or dot decimals. */
export function DecimalInput({ value, onValueChange, integer, ...props }: DecimalInputProps) {
  const [text, setText] = useState(() => toText(value, integer));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    setText(toText(value, integer));
  }

  return (
    <AffixInput
      inputMode={integer ? "numeric" : "decimal"}
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (integer) {
          const digits = raw.replace(/\D/g, "");
          const n = digits ? Number(digits) : null;
          setText(n === null ? "" : intFormat.format(n));
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
