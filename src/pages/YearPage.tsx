import { StatCard } from "../components/StatCard";
import { getMonthDates, hasMonthStarted } from "../lib/dateUtils";
import {
	formatDate,
	formatMinutes,
	formatMinutesOrDash,
	formatMinutesSpoken,
} from "../lib/formatting";
import { summarizePeriod } from "../lib/timeCalculations";
import { computeStatistics, formatStartMinutes } from "../lib/statistics";
import type { AppData } from "../App";

export function YearPage({
	data,
	onMonthSelect,
}: {
	data: AppData;
	refresh: () => Promise<void>;
	onMonthSelect: (monthDate: Date) => void;
}) {
	const now = new Date();
	const visibleYearDays = data.year.filter((day) =>
		hasMonthStarted(new Date(`${day.date}T00:00:00`), now),
	);
	const total = summarizePeriod(visibleYearDays, {
		settings: data.settings,
		kind: "year",
	});
	const noTargetMode = data.settings.workModelMode === "no_target_tracking";
	const stats = computeStatistics(visibleYearDays);
	return (
		<div className="page-stack">
			<div className="section-heading">
				<div>
					<span>Jahr</span>
					<h1>{now.getFullYear()}</h1>
				</div>
			</div>
			<div className="card-grid three">
				<StatCard
					label={noTargetMode ? "Arbeitszeit gesamt" : "Netto"}
					value={formatMinutes(total.netMinutes)}
				/>
				{noTargetMode ? (
					<StatCard
						label="Soll"
						value="nicht aktiv"
						detail="Kein Jahresziel"
						tone="neutral"
					/>
				) : (
					<StatCard
						label="Soll"
						value={formatMinutesOrDash(total.targetMinutes)}
					/>
				)}
				{noTargetMode ? (
					<StatCard label="Differenz" value="nicht aktiv" tone="neutral" />
				) : (
					<StatCard
						label="Jahressumme"
						value={
							total.differenceMinutes != null
								? formatMinutes(total.differenceMinutes, true)
								: "—"
						}
						tone={
							total.differenceMinutes != null && total.differenceMinutes >= 0
								? "positive"
								: "negative"
						}
					/>
				)}
			</div>
			<section className="month-card-grid">
				{Array.from({ length: 12 }, (_, month) => {
					const date = new Date(now.getFullYear(), month, 1);
					const keys = getMonthDates(date);
					const summaries = data.year.filter((day) => keys.includes(day.date));
					const started = hasMonthStarted(date, now);
					const summary = started
						? summarizePeriod(summaries, {
								settings: data.settings,
								kind: "month",
							})
						: {
								netMinutes: 0,
								targetMinutes: null as number | null,
								differenceMinutes: null as number | null,
							};
					const monthLabel = date.toLocaleDateString("de-DE", {
						month: "long",
						year: "numeric",
					});
					const hasDelta = !noTargetMode && summary.differenceMinutes != null;
					const status = !started
						? "Monat noch nicht gestartet"
						: noTargetMode
							? `Arbeitszeit ${formatMinutesSpoken(summary.netMinutes)}`
							: summary.differenceMinutes != null
								? `Monatsdifferenz ${formatMinutesSpoken(summary.differenceMinutes, true)}`
								: `Netto ${formatMinutesSpoken(summary.netMinutes)}`;
					return (
						<button
							className="glass-card month-card month-card-button"
							type="button"
							key={month}
							aria-label={`${monthLabel} öffnen, ${status}`}
							onClick={() => onMonthSelect(date)}
						>
							<span>{date.toLocaleDateString("de-DE", { month: "long" })}</span>
							{!started ? (
								<strong className="muted-text">{formatMinutes(0)}</strong>
							) : noTargetMode ? (
								<strong>{formatMinutes(summary.netMinutes)}</strong>
							) : hasDelta ? (
								<strong
									className={
										summary.differenceMinutes! >= 0
											? "positive-text"
											: "negative-text"
									}
								>
									{formatMinutes(summary.differenceMinutes!, true)}
								</strong>
							) : (
								<strong>{formatMinutes(summary.netMinutes)}</strong>
							)}
							<small>
								{!started
									? "Noch nicht gestartet"
									: noTargetMode
										? "Arbeitszeit"
										: `${formatMinutes(summary.netMinutes)} netto`}
							</small>
							{started && hasDelta && (
								<small className="state-badge">
									{summary.differenceMinutes! >= 0 ? "Plus" : "Minus"}
								</small>
							)}
							{started && noTargetMode && (
								<small className="state-badge">Erfasst</small>
							)}
						</button>
					);
				})}
			</section>

			{stats.workedDays > 0 && (
				<section className="glass-panel" aria-label="Trends">
					<div className="section-heading">
						<div>
							<span>Trends</span>
							<h2>Auswertung {now.getFullYear()}</h2>
						</div>
					</div>
					<div className="card-grid">
						<StatCard
							label="Erfasste Tage"
							value={String(stats.workedDays)}
							detail="mit Arbeitszeit"
						/>
						<StatCard
							label="Ø Arbeitsbeginn"
							value={formatStartMinutes(stats.averageStartMinutes)}
							detail="über erfasste Tage"
						/>
						<StatCard
							label="Ø Nettozeit/Tag"
							value={formatMinutesOrDash(stats.averageNetMinutes)}
							detail="pro Arbeitstag"
						/>
						<StatCard
							label="Längster Tag"
							value={
								stats.longestDay
									? formatMinutes(stats.longestDay.netMinutes)
									: "—"
							}
							detail={
								stats.longestDay ? formatDate(stats.longestDay.date) : undefined
							}
						/>
						<StatCard
							label="Kürzester Tag"
							value={
								stats.shortestDay
									? formatMinutes(stats.shortestDay.netMinutes)
									: "—"
							}
							detail={
								stats.shortestDay
									? formatDate(stats.shortestDay.date)
									: undefined
							}
						/>
						{!noTargetMode && (
							<StatCard
								label="Plus / Minus / Soll-Tage"
								value={`${stats.overtimeDays} / ${stats.undertimeDays} / ${stats.onTargetDays}`}
								detail="Tage über / unter / genau Soll"
								tone={
									stats.overtimeDays >= stats.undertimeDays
										? "positive"
										: "negative"
								}
							/>
						)}
					</div>
				</section>
			)}
		</div>
	);
}
