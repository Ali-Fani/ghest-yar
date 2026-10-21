import { Field, NumInput } from "./ui/Input";
import { MoneyInput } from "./ui/MoneyInput";
import { Segmented } from "./ui/Misc";
import { FEE_LABEL } from "../lib/constants";
import type { FeeType } from "../lib/types";

/** Fee (کارمزد) editor: none / fixed Toman / percent. The value is a Latin-digit string. */
export function FeeFields({
  type,
  value,
  onType,
  onValue,
  label = "کارمزد",
  percentOf = "مبلغ",
}: {
  type: FeeType;
  value: string;
  onType: (t: FeeType) => void;
  onValue: (v: string) => void;
  label?: string;
  percentOf?: string;
}) {
  return (
    <>
      <Field label={label}>
        <Segmented
          className="w-full"
          value={type}
          onChange={(v) => {
            onType(v);
            if (v === "none") onValue("0");
          }}
          options={(["none", "fixed", "percent"] as const).map((v) => ({ value: v, label: FEE_LABEL[v] }))}
        />
      </Field>
      {type !== "none" && (
        <Field label={type === "fixed" ? "مبلغ کارمزد" : `درصد کارمزد (از ${percentOf})`}>
          {type === "fixed" ? (
            <MoneyInput value={Math.round(Number(value) || 0)} onChange={(n) => onValue(String(n))} chips={false} />
          ) : (
            <NumInput decimal value={value} onChange={onValue} suffix="٪" />
          )}
        </Field>
      )}
    </>
  );
}
