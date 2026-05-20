import type { ReactNode } from "react";
import { formatMinutes } from "../lib/formatting";

interface Props {
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: "positive" | "negative" | "neutral";
}

export function StatCard({ label, value, detail, tone = "neutral" }: Props) {
  return (
    <section className={`glass-card stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </section>
  );
}

export function DiffValue({ minutes }: { minutes: number }) {
  return <span className={minutes >= 0 ? "diff positive-text" : "diff negative-text"}>{formatMinutes(minutes, true)}</span>;
}
