import {
	App,
	ItemView,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
	moment
} from "obsidian";

const VIEW_TYPE_RECALL = "vault-recall-view";

type ReviewGrade = "forgot" | "hard" | "good" | "easy";

interface ReviewItem {
	interval: number;
	nextReview: string;
	easeFactor: number;
	reps: number;
	lapses: number;
	lastGrade: ReviewGrade;
	lastReviewedAt?: string;
}

interface ReviewSessionState {
	date: string;
	queuePaths: string[];
	index: number;
	reviewedToday: number;
}

interface VaultRecallData {
	reviews: Record<string, ReviewItem>;
	session?: ReviewSessionState;
}
interface VaultRecallSettings {
	reviewTag: string;
}

const DEFAULT_SETTINGS: VaultRecallSettings = {
	reviewTag: "#review"
};

const DEFAULT_DATA: VaultRecallData = {
	reviews: {},
	session: undefined
};

export default class VaultRecallPlugin extends Plugin {
	settings: VaultRecallSettings = DEFAULT_SETTINGS;
	data: VaultRecallData = DEFAULT_DATA;
	reviewNoteLeaf: WorkspaceLeaf | null = null;

	getReviewedTodayCount(): number {
		const today = moment().format("YYYY-MM-DD");
		return Object.values(this.data.reviews).filter(review => review.lastReviewedAt === today).length;
	}

	async refreshOpenRecallViews(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_RECALL);
    for (const leaf of leaves) {
      if (leaf.view instanceof VaultRecallView) {
        await leaf.view.refreshSession();
      }
    }
  }

	async onload(): Promise<void> {
		await this.loadPluginData();

		this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          void this.refreshOpenRecallViews();
        }
      })
    );

		this.registerView(
			VIEW_TYPE_RECALL,
			(leaf) => new VaultRecallView(leaf, this)
		);

		this.addRibbonIcon("brain", "Open Vault Recall", () => {
void this.activateView();
});

		this.addCommand({
id: "open-vault-recall",
name: "Open Vault Recall",
callback: () => {
void this.activateView();
}
});

		this.addSettingTab(new VaultRecallSettingTab(this.app, this));

		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (!(file instanceof TFile)) return;
				void this.handleFileRename(file, oldPath);
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (!(file instanceof TFile)) return;
				void this.handleFileDelete(file);
			})
		);
	}

	async onunload(): Promise<void> {
		// Nada específico por enquanto
	}

	async activateView(): Promise<void> {
		const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_RECALL)[0];

		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);

			if (existingLeaf.view instanceof VaultRecallView) {
				await existingLeaf.view.refreshSession();
			}

			return;
		}

		const newLeaf = this.app.workspace.getRightLeaf(false);
		if (!newLeaf) return;

		await newLeaf.setViewState({
			type: VIEW_TYPE_RECALL,
			active: true
		});

		this.app.workspace.revealLeaf(newLeaf);

		if (newLeaf.view instanceof VaultRecallView) {
			await newLeaf.view.refreshSession();
		}
	}

	async loadPluginData(): Promise<void> {
		const raw = await this.loadData();

		if (raw?.settings) {
			this.settings = {
				...DEFAULT_SETTINGS,
				...raw.settings
			};
		} else {
			this.settings = { ...DEFAULT_SETTINGS };
		}

		if (raw?.data) {
			this.data = {
				reviews: raw.data.reviews ?? {}
			};
		} else {
			this.data = { ...DEFAULT_DATA };
		}
	}

	async savePluginData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			data: this.data
		});
	}

	normalizeTag(tag: string): string {
		return tag.trim().replace(/^#+/, "").toLowerCase();
	}

	extractInlineTags(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		return cache?.tags?.map((tag) => this.normalizeTag(tag.tag)).filter(Boolean) ?? [];
	}

	extractFrontmatterTags(file: TFile): string[] {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;

		if (!frontmatter) return [];

		const rawTags = frontmatter.tags ?? frontmatter.tag;

		if (typeof rawTags === "string") {
			return rawTags
				.split(",")
				.map((tag) => this.normalizeTag(tag))
				.filter(Boolean);
		}

		if (Array.isArray(rawTags)) {
			return rawTags
				.filter((tag): tag is string => typeof tag === "string")
				.flatMap((tag) => tag.split(","))
				.map((tag) => this.normalizeTag(tag))
				.filter(Boolean);
		}

		return [];
	}

	fileHasReviewTag(file: TFile): boolean {
		const targetTag = this.normalizeTag(this.settings.reviewTag);
		const allTags = new Set([
			...this.extractInlineTags(file),
			...this.extractFrontmatterTags(file)
		]);

		return allTags.has(targetTag);
	}

	createDefaultReviewItem(): ReviewItem {
		return {
			interval: 1,
			nextReview: moment().format("YYYY-MM-DD"),
			easeFactor: 2.5,
			reps: 0,
			lapses: 0,
			lastGrade: "good"
		};
	}

	getAllReviewNotes(): TFile[] {
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => this.fileHasReviewTag(file));
	}

	isDueToday(path: string): boolean {
		const review = this.data.reviews[path];

		if (!review) return true;

		return moment(review.nextReview).isSameOrBefore(moment(), "day");
	}

	getDueNotes(): TFile[] {
		return this.getAllReviewNotes().filter((file) => this.isDueToday(file.path));
	}

	hasReusableReviewNoteLeaf(): boolean {
		if (!this.reviewNoteLeaf) return false;
		return this.app.workspace.getLeavesOfType("markdown").includes(this.reviewNoteLeaf);
	}

	async openNote(file: TFile): Promise<void> {
let targetLeaf: WorkspaceLeaf | null =
this.reviewNoteLeaf &&
this.app.workspace.getLeavesOfType("markdown").includes(this.reviewNoteLeaf)
? this.reviewNoteLeaf
: null;if (!targetLeaf) {
	const recentLeaf = this.app.workspace.getMostRecentLeaf();
	if (recentLeaf && recentLeaf.view.getViewType() === "markdown") {
		targetLeaf = recentLeaf;
	}
}

if (!targetLeaf) {
	targetLeaf =
		this.app.workspace
			.getLeavesOfType("markdown")
			.find((leaf) => leaf.view.getViewType() === "markdown") ?? null;
}

if (!targetLeaf) {
	targetLeaf = this.app.workspace.getLeaf(true);
}

this.reviewNoteLeaf = targetLeaf;

await targetLeaf.openFile(file);
this.app.workspace.revealLeaf(targetLeaf);
}

	async gradeReview(file: TFile, grade: ReviewGrade): Promise<void> {
		const path = file.path;
		const current = this.data.reviews[path] ?? this.createDefaultReviewItem();
		const previousReps = current.reps;

		let nextInterval = current.interval;
		let nextEaseFactor = current.easeFactor;
		let nextReps = current.reps;
		let nextLapses = current.lapses;

		switch (grade) {
			case "forgot":
				nextLapses += 1;
				nextReps = 0;
				nextInterval = 1;
				nextEaseFactor = Math.max(1.3, current.easeFactor - 0.2);
				break;

			case "hard":
				nextInterval = previousReps <= 1
					? 2
					: Math.max(2, Math.round(current.interval * 1.25));
				nextReps = Math.max(1, current.reps);
				nextEaseFactor = Math.max(1.3, current.easeFactor - 0.1);
				break;

			case "good":
				nextReps = current.reps + 1;
				nextInterval = previousReps === 0
					? 1
					: previousReps === 1
						? 3
						: Math.max(3, Math.round(current.interval * current.easeFactor));
				break;

			case "easy":
				nextReps = current.reps + 1;
				nextInterval = previousReps === 0
					? 2
					: previousReps === 1
						? 5
						: Math.max(5, Math.round(current.interval * (current.easeFactor + 0.3)));
				nextEaseFactor = current.easeFactor + 0.1;
				break;
		}

		this.data.reviews[path] = {
			interval: nextInterval,
			nextReview: moment().add(nextInterval, "days").format("YYYY-MM-DD"),
			easeFactor: nextEaseFactor,
			reps: nextReps,
			lapses: nextLapses,
			lastGrade: grade,
			lastReviewedAt: moment().format("YYYY-MM-DD")
		};

		await this.savePluginData();
	}

	async handleFileRename(file: TFile, oldPath: string): Promise<void> {
		const existingReview = this.data.reviews[oldPath];
		if (!existingReview) return;

		this.data.reviews[file.path] = existingReview;
		delete this.data.reviews[oldPath];

		await this.savePluginData();
	}

	async handleFileDelete(file: TFile): Promise<void> {
		const existingReview = this.data.reviews[file.path];
		if (!existingReview) return;

		delete this.data.reviews[file.path];
		await this.savePluginData();
	}

	getNextUpcomingDate(): string | null {
		const futureDates: string[] = [];

		for (const review of Object.values(this.data.reviews)) {
			if (moment(review.nextReview).isAfter(moment(), "day")) {
				futureDates.push(review.nextReview);
			}
		}

		futureDates.sort();

		return futureDates[0] ?? null;
	}
}

class VaultRecallView extends ItemView {
	sessionQueue: TFile[] = [];
	index = 0;
	reviewedToday = 0;
	revealed = false;
	plugin: VaultRecallPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: VaultRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	persistSessionState(): void {
		this.plugin.data.session = {
			date: moment().format("YYYY-MM-DD"),
			queuePaths: this.sessionQueue.map(file => file.path),
			index: this.index,
			reviewedToday: this.reviewedToday
		};
		this.plugin.savePluginData();
	}

	getViewType(): string {
		return VIEW_TYPE_RECALL;
	}

	getDisplayText(): string {
		return "Vault Recall";
	}

	getIcon(): string {
		return "brain";
	}

	async onOpen(): Promise<void> {
		await this.refreshSession();
	}

	async refreshSession(): Promise<void> {
    const today = moment().format("YYYY-MM-DD");
    const currentDueNotes = this.plugin.getDueNotes();
    const savedSession = this.plugin.data.session;
    if (savedSession && savedSession.date === today) {
      const restoredQueue: TFile[] = savedSession.queuePaths
        .map((path: string) => this.app.vault.getAbstractFileByPath(path))
        .filter((file): file is TFile => file instanceof TFile);
      const filteredQueue = restoredQueue.filter((file) =>
        currentDueNotes.some((due) => due.path === file.path)
      );
      const restoredPaths = new Set(filteredQueue.map((file) => file.path));
      const newNotes = currentDueNotes.filter((note) => !restoredPaths.has(note.path));
      this.sessionQueue = [...filteredQueue, ...newNotes];
      this.index = Math.min(savedSession.index, this.sessionQueue.length);
      this.reviewedToday = savedSession.reviewedToday;
    } else {
      this.sessionQueue = currentDueNotes;
      this.index = 0;
      this.reviewedToday = 0;
    }
    this.revealed = false;
    this.persistSessionState();
    await this.render();
  }


	getCurrentFile(): TFile | null {
		return this.sessionQueue[this.index] ?? null;
	}

	createOverviewItem(parent: HTMLElement, label: string, value: string): void {
		const item = parent.createDiv({ cls: "vault-recall-overview-item" });
		item.createDiv({ cls: "vault-recall-overview-label", text: label });
		item.createDiv({ cls: "vault-recall-overview-value", text: value });
	}

	renderSidebar(sidebar: HTMLElement): void {
		sidebar.createEl("h2", { text: "Overview", cls: "vault-recall-section-title" });

		const overview = sidebar.createDiv({ cls: "vault-recall-overview" });
		const totalTagged = this.plugin.getAllReviewNotes().length;
		const dueToday = Math.max(0, this.sessionQueue.length - this.index);

		this.createOverviewItem(overview, "Total tagged notes", String(totalTagged));
		this.createOverviewItem(overview, "Due today", String(dueToday));
		this.createOverviewItem(overview, "Reviewed today", String(this.reviewedToday));
	}

	async render(): Promise<void> {
		const el = this.contentEl;
		el.empty();
		el.addClass("vault-recall-container");

		const shell = el.createDiv({ cls: "vault-recall-shell" });
		const sidebar = shell.createDiv({ cls: "vault-recall-sidebar" });
		const main = shell.createDiv({ cls: "vault-recall-main" });

		this.renderSidebar(sidebar);

		if (this.sessionQueue.length === 0 || this.index >= this.sessionQueue.length) {
			this.renderDone(main);
			return;
		}

		const file = this.getCurrentFile();
		if (!file) {
			this.renderDone(main);
			return;
		}

		const card = main.createDiv({ cls: "vault-recall-note-card" });

		card.createEl("h3", {
	text: `Today's Review • ${Math.min(this.index + 1, this.sessionQueue.length)} of ${this.sessionQueue.length}`
});

		card.createEl("h1", {
			text: file.basename
		});

		if (!this.revealed) {
			const text = card.createEl("p", {
				text: "Pause and mentally reconstruct the note before checking it."
			});
			text.addClass("vault-recall-muted");

			const openBtn = card.createEl("button", {
				text: "Open Note"
			});
			openBtn.addClass("vault-recall-btn");

			openBtn.onclick = async () => {
				await this.plugin.openNote(file);
				this.revealed = true;
				await this.render();
			};

			return;
		}

		card.createEl("p", {
			text: "How was your recall?"
		});

		const row = card.createDiv({ cls: "vault-recall-row" });

		this.makeGradeButton(row, "Forgot", file, "forgot");
		this.makeGradeButton(row, "Hard", file, "hard");
		this.makeGradeButton(row, "Good", file, "good");
		this.makeGradeButton(row, "Easy", file, "easy");
	}

	makeGradeButton(
		parent: HTMLDivElement,
		label: string,
		file: TFile,
		grade: ReviewGrade
	): void {
		const btn = parent.createEl("button", {
			text: label
		});

		btn.addClass("vault-recall-btn");

		btn.onclick = async () => {
			await this.plugin.gradeReview(file, grade);

			if (grade === "forgot") {
				this.sessionQueue.push(file);
			}

			this.reviewedToday += 1;
			this.index += 1;
			this.revealed = false;

			this.persistSessionState();
			await this.render();
		};
	}

	renderDone(main: HTMLElement): void {
		const empty = main.createDiv({ cls: "vault-recall-empty" });

		empty.createEl("h2", {
			text: "Done today ✅"
		});

		empty.createEl("p", {
			text: `${this.reviewedToday} notes reviewed`
		});

		const next = this.plugin.getNextUpcomingDate();

		if (next) {
			const days = moment(next).startOf("day").diff(moment().startOf("day"), "days");

			empty.createEl("p", {
				text: `Next review • ${moment(next).format("MMM D")} (in ${days} ${days === 1 ? "day" : "days"})`
			});
		} else {
			empty.createEl("p", {
				text: "No upcoming reviews scheduled"
			});
		}

		const closeBtn = empty.createEl("button", {
			text: "Close"
		});

		closeBtn.addClass("vault-recall-btn");

		closeBtn.onclick = async () => {
			await this.leaf.detach();
		};
	}
}

class VaultRecallSettingTab extends PluginSettingTab {
	plugin: VaultRecallPlugin;

	constructor(app: App, plugin: VaultRecallPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Review tag")
			.setDesc("Notes with this tag enter the review queue.")
			.addText((text) =>
				text
					.setPlaceholder("#review")
					.setValue(this.plugin.settings.reviewTag)
					.onChange(async (value) => {
						this.plugin.settings.reviewTag = value.trim() || "#review";
						await this.plugin.savePluginData();
					})
			);
	}
}
