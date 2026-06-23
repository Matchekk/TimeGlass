import {
	formatClock,
	formatLongDate,
	formatMinutes,
	formatMinutesOrDash,
} from "../lib/formatting";
import type { DaySummary, PeriodSummary } from "../types";

const dayTypeLabels: Record<string, string> = {
	work: "Arbeitstag",
	free: "Arbeitsfrei",
	sick: "Krank",
	vacation: "Urlaub",
	other: "Sonstiges",
};

export function PrintableReport({
	title,
	days,
	total,
	showTarget,
}: {
	title: string;
	days: DaySummary[];
	total: PeriodSummary;
	showTarget: boolean;
}) {
	const rows = days.filter(
		(day) =>
			day.netMinutes > 0 ||
			(day.targetMinutes ?? 0) > 0 ||
			day.dayType !== "work",
	);

	return (
		<div className="print-report" aria-hidden="true">
			<div className="print-header">
				<h1>TimeGlass – Arbeitszeitbericht</h1>
				<h2>{title}</h2>
				<p>
					Erstellt am{" "}
					{new Intl.DateTimeFormat("de-DE", {
						dateStyle: "long",
						timeStyle: "short",
					}).format(new Date())}
				</p>
				<p className="print-disclaimer">
					Private Übersicht – keine rechtsverbindliche Zeiterfassung.
				</p>
			</div>
			<table className="print-table">
				<thead>
					<tr>
						<th>Datum</th>
						<th>Beginn</th>
						<th>Ende</th>
						<th>Brutto</th>
						<th>Pause</th>
						<th>Netto</th>
						{showTarget && <th>Soll</th>}
						{showTarget && <th>Differenz</th>}
						<th>Art / Notiz</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((day) => (
						<tr key={day.date}>
							<td>{formatLongDate(day.date)}</td>
							<td>{formatClock(day.firstStart)}</td>
							<td>{formatClock(day.lastEnd)}</td>
							<td>{formatMinutes(day.grossMinutes)}</td>
							<td>{formatMinutes(day.breakMinutes)}</td>
							<td>{formatMinutes(day.netMinutes)}</td>
							{showTarget && <td>{formatMinutesOrDash(day.targetMinutes)}</td>}
							{showTarget && (
								<td>
									{day.differenceMinutes != null
										? formatMinutes(day.differenceMinutes, true)
										: "—"}
								</td>
							)}
							<td>
								{[dayTypeLabels[day.dayType] ?? day.dayType, day.note]
									.filter(Boolean)
									.join(" · ")}
							</td>
						</tr>
					))}
				</tbody>
				<tfoot>
					<tr>
						<td colSpan={5}>Summe</td>
						<td>{formatMinutes(total.netMinutes)}</td>
						{showTarget && <td>{formatMinutesOrDash(total.targetMinutes)}</td>}
						{showTarget && (
							<td>
								{total.differenceMinutes != null
									? formatMinutes(total.differenceMinutes, true)
									: "—"}
							</td>
						)}
						<td />
					</tr>
				</tfoot>
			</table>
		</div>
	);
}
