import {
	Bell,
	Check,
	Droplets,
	History,
	Leaf,
	Pencil,
	Plus,
	Settings,
	Sprout,
	ThermometerSun,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getPlants, getPlantGlassSettings, savePlant, savePlantGlassSettings, updatePlantState } from "../db/plants";
import {
	defaultPlantGlassSettings,
	heaterHint,
	isPlantDue,
	markStillMoist,
	markWatered,
	nextCheckDate,
	plantStatus,
	plantTemplates,
	snoozeUntilTomorrow,
} from "../lib/plantGlass";
import { toDateKey } from "../lib/dateUtils";
import type { Plant, PlantGlassSettings, PlantStatus } from "../types";

export type PlantGlassPage =
	| "overview"
	| "plants"
	| "care-history"
	| "settings";
type PlantDraft = Omit<Plant, "id" | "createdAt" | "updatedAt"> & {
	id?: string;
};

const emptyPlant = (
	settings: PlantGlassSettings,
): PlantDraft => ({
	name: "",
	species: "",
	location: "",
	checkIntervalDays: settings.defaultCheckIntervalDays,
	nearHeater: false,
	heaterSensitive: false,
	lightNote: "",
	lastCheckedAt: null,
	lastWateredAt: null,
	snoozedUntil: null,
	notes: "",
	active: true,
});

const statusLabels: Record<PlantStatus, string> = {
	due_today: "Heute prüfen",
	due_soon: "Bald prüfen",
	ok: "Okay",
	paused: "Pausiert",
	snoozed_tomorrow: "Morgen erinnert",
};

function formatDate(value: string | null): string {
	if (!value) return "-";
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
	}).format(new Date(value));
}

export function PlantGlassApp({ page }: { page: PlantGlassPage }) {
	const [plants, setPlants] = useState<Plant[]>([]);
	const [settings, setSettings] = useState<PlantGlassSettings>(
		defaultPlantGlassSettings,
	);
	const [editing, setEditing] = useState<
		PlantDraft | null
	>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const refresh = async () => {
		try {
			const nextSettings = await getPlantGlassSettings();
			setSettings(nextSettings);
			setPlants(await getPlants(nextSettings.showInactivePlants));
			setError(null);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "PlantGlass-Daten konnten nicht geladen werden.",
			);
		}
	};

	useEffect(() => {
		void refresh();
	}, []);

	const visiblePlants = useMemo(
		() =>
			settings.showInactivePlants
				? plants
				: plants.filter((plant) => plant.active),
		[plants, settings.showInactivePlants],
	);
	const duePlants = visiblePlants.filter((plant) => isPlantDue(plant));
	const lastWatered = visiblePlants
		.filter((plant) => plant.lastWateredAt)
		.sort((a, b) =>
			String(b.lastWateredAt).localeCompare(String(a.lastWateredAt)),
		)[0];
	const heaterPlants = visiblePlants.filter((plant) => plant.nearHeater);

	async function handleStillMoist(plant: Plant) {
		try {
			await updatePlantState(markStillMoist(plant));
			setMessage(`${plant.name}: geprüft, noch feucht.`);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
		}
	}

	async function handleWatered(plant: Plant) {
		try {
			await updatePlantState(markWatered(plant));
			setMessage(
				`${plant.name}: gegossen. Überschüssiges Wasser nach 10 Minuten aus dem Übertopf entfernen.`,
			);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
		}
	}

	async function handleSnooze(plant: Plant) {
		try {
			await updatePlantState(snoozeUntilTomorrow(plant));
			setMessage(`${plant.name}: morgen erneut prüfen.`);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
		}
	}

	async function submitPlant(event: FormEvent) {
		event.preventDefault();
		if (!editing) return;
		if (!editing.name.trim() || !editing.location.trim()) {
			setMessage("Name und Standort sind Pflichtfelder.");
			return;
		}
		try {
			await savePlant({
				...editing,
				name: editing.name.trim(),
				location: editing.location.trim(),
				species: editing.species?.trim() || null,
				lightNote: editing.lightNote?.trim() || null,
				notes: editing.notes.trim(),
				lastCheckedAt: editing.lastCheckedAt ?? null,
				lastWateredAt: editing.lastWateredAt ?? null,
				snoozedUntil: editing.snoozedUntil ?? null,
				checkIntervalDays: Math.max(1, Math.round(editing.checkIntervalDays)),
			});
			setEditing(null);
			setMessage("Pflanze gespeichert.");
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
		}
	}

	async function submitSettings(event: FormEvent) {
		event.preventDefault();
		try {
			await savePlantGlassSettings(settings);
			setMessage("PlantGlass-Einstellungen gespeichert.");
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
		}
	}

	const plantList = (
		<div className="plant-card-grid">
			{visiblePlants.length === 0 ? (
				<section className="glass-card plant-empty">
					<Leaf size={24} aria-hidden="true" />
					<h2>Noch keine Pflanzen</h2>
					<p>
						Lege deine erste Büro-Pflanze an oder nutze eine Bogenhanf-Vorlage.
					</p>
					<button
						type="button"
						className="secondary-button"
						onClick={() => setEditing(emptyPlant(settings))}
					>
						<Plus size={16} aria-hidden="true" /> Pflanze anlegen
					</button>
				</section>
			) : (
				visiblePlants.map((plant) => (
					<PlantCard
						key={plant.id}
						plant={plant}
						onStillMoist={() => void handleStillMoist(plant)}
						onWatered={() => void handleWatered(plant)}
						onSnooze={() => void handleSnooze(plant)}
						onEdit={() => setEditing(plant)}
					/>
				))
			)}
		</div>
	);

	return (
		<div className="page-stack plantglass-page">
			{error && <div className="error-banner">{error}</div>}
			{message && <div className="success-banner">{message}</div>}

			{page === "overview" && (
				<>
					<section className="glass-panel hero plant-hero">
						<div>
							<span className="eyebrow">PlantGlass</span>
							<h1>PlantGlass</h1>
							<p>Deine Büro-Pflanzen im Blick.</p>
						</div>
						<button
							type="button"
							className="secondary-button"
							onClick={() => setEditing(emptyPlant(settings))}
						>
							<Plus size={16} aria-hidden="true" /> Pflanze anlegen
						</button>
					</section>

					<section className="glass-panel plant-rule-box">
						<strong>Nicht nach Kalender gießen.</strong>
						<p>
							Der Kalender erinnert nur ans Prüfen. Finger 3-5 cm in die Erde
							stecken. Nur gießen, wenn trocken. Kein Wasser im Übertopf stehen
							lassen.
						</p>
					</section>

					<section className="card-grid plant-dashboard-grid">
						<PlantStat label="Pflanzen gesamt" value={String(visiblePlants.length)} />
						<PlantStat label="Heute zu prüfen" value={String(duePlants.length)} />
						<PlantStat
							label="Zuletzt gegossen"
							value={lastWatered ? formatDate(lastWatered.lastWateredAt) : "-"}
						/>
						<PlantStat
							label="Kritische Hinweise"
							value={String(heaterPlants.length)}
							helper={
								heaterPlants.length > 0
									? "Heizungsnähe bewusst prüfen"
									: "Alles im grünen Bereich"
							}
						/>
					</section>

					{plantList}
				</>
			)}

			{page === "plants" && (
				<>
					<div className="section-heading">
						<div>
							<span>Pflanzen</span>
							<h1>Pflanzen verwalten</h1>
						</div>
						<button
							type="button"
							className="secondary-button"
							onClick={() => setEditing(emptyPlant(settings))}
						>
							<Plus size={16} aria-hidden="true" /> Pflanze anlegen
						</button>
					</div>
					<section className="glass-panel template-panel">
						<h2>Bogenhanf-Vorlagen</h2>
						<div className="button-row">
							{plantTemplates.map((template) => (
								<button
									key={template.name}
									type="button"
									className="secondary-button"
									onClick={() =>
										setEditing({
											...emptyPlant(settings),
											...template,
											heaterSensitive: template.nearHeater,
										})
									}
								>
									<Sprout size={16} aria-hidden="true" /> {template.name}
								</button>
							))}
						</div>
					</section>
					{plantList}
				</>
			)}

			{page === "care-history" && (
				<>
					<div className="section-heading">
						<div>
							<span>Pflegeverlauf</span>
							<h1>Letzte Checks</h1>
						</div>
					</div>
					<section className="glass-panel table-panel">
						{visiblePlants.length === 0 ? (
							<p className="muted">Noch keine Pflanzen erfasst.</p>
						) : (
							visiblePlants.map((plant) => (
								<div className="diagnostics-line" key={plant.id}>
									<span>{plant.name}</span>
									<strong>
										Geprüft {formatDate(plant.lastCheckedAt)} · Gegossen{" "}
										{formatDate(plant.lastWateredAt)}
									</strong>
								</div>
							))
						)}
					</section>
				</>
			)}

			{page === "settings" && (
				<>
					<div className="section-heading">
						<div>
							<span>Einstellungen</span>
							<h1>PlantGlass konfigurieren</h1>
						</div>
					</div>
					<form className="glass-panel settings-form" onSubmit={submitSettings}>
						<label>
							Standard-Checkintervall
							<input
								type="number"
								min={1}
								value={settings.defaultCheckIntervalDays}
								onChange={(event) =>
									setSettings({
										...settings,
										defaultCheckIntervalDays:
											Number(event.target.value) || 14,
									})
								}
							/>
						</label>
						<label>
							Standard-Erinnerungszeit
							<input
								type="time"
								value={settings.defaultReminderTime}
								onChange={(event) =>
									setSettings({
										...settings,
										defaultReminderTime: event.target.value,
									})
								}
							/>
						</label>
						<label className="switch-row wide">
							<input
								type="checkbox"
								checked={settings.reminderEnabled}
								onChange={(event) =>
									setSettings({
										...settings,
										reminderEnabled: event.target.checked,
									})
								}
							/>
							Reminder aktiv
						</label>
						<label className="switch-row wide">
							<input
								type="checkbox"
								checked={settings.showInactivePlants}
								onChange={(event) =>
									setSettings({
										...settings,
										showInactivePlants: event.target.checked,
									})
								}
							/>
							Deaktivierte Pflanzen anzeigen
						</label>
						<button className="secondary-button wide" type="submit">
							<Settings size={16} aria-hidden="true" /> PlantGlass speichern
						</button>
					</form>
				</>
			)}

			{editing && (
				<form className="glass-panel settings-form plant-editor" onSubmit={submitPlant}>
					<h2 className="wide">
						{editing.id ? "Pflanze bearbeiten" : "Pflanze anlegen"}
					</h2>
					<label>
						Name
						<input
							value={editing.name}
							onChange={(event) =>
								setEditing({ ...editing, name: event.target.value })
							}
						/>
					</label>
					<label>
						Art/Sorte
						<input
							value={editing.species ?? ""}
							onChange={(event) =>
								setEditing({ ...editing, species: event.target.value })
							}
						/>
					</label>
					<label>
						Standort
						<input
							value={editing.location}
							onChange={(event) =>
								setEditing({ ...editing, location: event.target.value })
							}
						/>
					</label>
					<label>
						Check-Intervall in Tagen
						<input
							type="number"
							min={1}
							value={editing.checkIntervalDays}
							onChange={(event) =>
								setEditing({
									...editing,
									checkIntervalDays: Number(event.target.value) || 14,
								})
							}
						/>
					</label>
					<label className="switch-row">
						<input
							type="checkbox"
							checked={editing.nearHeater}
							onChange={(event) =>
								setEditing({ ...editing, nearHeater: event.target.checked })
							}
						/>
						Nahe Heizung
					</label>
					<label className="switch-row">
						<input
							type="checkbox"
							checked={editing.heaterSensitive}
							onChange={(event) =>
								setEditing({
									...editing,
									heaterSensitive: event.target.checked,
								})
							}
						/>
						Heizung sensibel markieren
					</label>
					<label className="switch-row">
						<input
							type="checkbox"
							checked={editing.active}
							onChange={(event) =>
								setEditing({ ...editing, active: event.target.checked })
							}
						/>
						Aktiv
					</label>
					<label className="wide">
						Lichtnotiz
						<input
							value={editing.lightNote ?? ""}
							onChange={(event) =>
								setEditing({ ...editing, lightNote: event.target.value })
							}
						/>
					</label>
					<label className="wide">
						Notizen
						<input
							value={editing.notes}
							onChange={(event) =>
								setEditing({ ...editing, notes: event.target.value })
							}
						/>
					</label>
					<div className="button-row wide">
						<button className="secondary-button" type="submit">
							<Check size={16} aria-hidden="true" /> Speichern
						</button>
						<button
							className="secondary-button"
							type="button"
							onClick={() => setEditing(null)}
						>
							Abbrechen
						</button>
					</div>
				</form>
			)}
		</div>
	);
}

function PlantStat({
	label,
	value,
	helper,
}: {
	label: string;
	value: string;
	helper?: string;
}) {
	return (
		<div className="glass-card stat-card plant-stat">
			<span>{label}</span>
			<strong>{value}</strong>
			<small>{helper ?? "Prüfen statt blind gießen"}</small>
		</div>
	);
}

function PlantCard({
	plant,
	onStillMoist,
	onWatered,
	onSnooze,
	onEdit,
}: {
	plant: Plant;
	onStillMoist: () => void;
	onWatered: () => void;
	onSnooze: () => void;
	onEdit: () => void;
}) {
	const status = plantStatus(plant);
	const hint = heaterHint(plant);
	return (
		<section className="glass-card plant-card">
			<div className="plant-card-header">
				<div>
					<span>{plant.species || "Pflanze"}</span>
					<h2>{plant.name}</h2>
				</div>
				<strong className={`plant-status ${status}`}>
					{statusLabels[status]}
				</strong>
			</div>
			<div className="plant-facts">
				<span>Standort</span>
				<strong>{plant.location}</strong>
				<span>Letzter Check</span>
				<strong>{formatDate(plant.lastCheckedAt)}</strong>
				<span>Letztes Gießen</span>
				<strong>{formatDate(plant.lastWateredAt)}</strong>
				<span>Nächster Check</span>
				<strong>{nextCheckDate(plant) ?? toDateKey()}</strong>
			</div>
			{plant.lightNote && <p className="muted">{plant.lightNote}</p>}
			{plant.notes && <p className="muted">{plant.notes}</p>}
			{hint && (
				<div className="inline-warning plant-heater-hint">
					<ThermometerSun size={16} aria-hidden="true" /> {hint}
				</div>
			)}
			<div className="plant-actions">
				<button type="button" className="secondary-button" onClick={onStillMoist}>
					<Check size={16} aria-hidden="true" /> Noch feucht
				</button>
				<button type="button" className="secondary-button" onClick={onWatered}>
					<Droplets size={16} aria-hidden="true" /> Gegossen
				</button>
				<button type="button" className="secondary-button" onClick={onSnooze}>
					<Bell size={16} aria-hidden="true" /> Morgen erinnern
				</button>
				<button type="button" className="secondary-button" onClick={onEdit}>
					<Pencil size={16} aria-hidden="true" /> Bearbeiten
				</button>
			</div>
		</section>
	);
}
