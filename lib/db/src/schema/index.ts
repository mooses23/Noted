import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  real,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const songStatusEnum = pgEnum("song_status", [
  "draft",
  "active",
  "archived",
]);

export const songPhaseEnum = pgEnum("song_phase", [
  "structure",
  "accents",
]);

export const roundKindEnum = pgEnum("round_kind", [
  "structure",
  "accent",
]);

export const mergeBehaviorEnum = pgEnum("merge_behavior", [
  "single",
  "multi",
]);

export const roundStatusEnum = pgEnum("round_status", [
  "draft",
  "open",
  "closed",
  "merged",
]);

export const commitStatusEnum = pgEnum("commit_status", [
  "pending",
  "shortlisted",
  "merged",
  "rejected",
]);

export const songFileTypeEnum = pgEnum("song_file_type", [
  "official_mix",
  "stem",
  "click",
  "preview",
  "cover",
  "other",
]);

export const profilesTable = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").unique(),
  displayName: text("display_name").notNull(),
  username: text("username").unique(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  socialHandle: text("social_handle"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const songsTable = pgTable(
  "songs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    creatorName: text("creator_name").notNull(),
    genre: text("genre").notNull(),
    bpm: integer("bpm").notNull(),
    musicalKey: text("musical_key").notNull(),
    timeSignature: text("time_signature"),
    status: songStatusEnum("status").notNull().default("active"),
    phase: songPhaseEnum("phase").notNull().default("structure"),
    currentVersionId: uuid("current_version_id"),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("songs_slug_uq").on(t.slug)],
);

export const songFilesTable = pgTable(
  "song_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    fileType: songFileTypeEnum("file_type").notNull(),
    label: text("label").notNull(),
    fileUrl: text("file_url").notNull(),
    originalFilename: text("original_filename").notNull(),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("song_files_song_idx").on(t.songId)],
);

export const roundsTable = pgTable(
  "rounds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    allowedInstrumentType: text("allowed_instrument_type").notNull(),
    kind: roundKindEnum("kind").notNull().default("structure"),
    mergeBehavior: mergeBehaviorEnum("merge_behavior").notNull().default("single"),
    status: roundStatusEnum("status").notNull().default("draft"),
    baseVersionId: uuid("base_version_id"),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("rounds_song_number_uq").on(t.songId, t.roundNumber),
    index("rounds_song_idx").on(t.songId),
  ],
);

export const commitsTable = pgTable(
  "commits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    roundId: uuid("round_id")
      .notNull()
      .references(() => roundsTable.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    note: text("note"),
    instrumentType: text("instrument_type").notNull(),
    kind: roundKindEnum("kind").notNull().default("structure"),
    audioFileUrl: text("audio_file_url").notNull(),
    previewMixUrl: text("preview_mix_url"),
    overlayOffsetSeconds: real("overlay_offset_seconds").notNull().default(0),
    status: commitStatusEnum("status").notNull().default("pending"),
    confirmedHumanMade: boolean("confirmed_human_made").notNull().default(false),
    confirmedRightsGrant: boolean("confirmed_rights_grant")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("commits_round_idx").on(t.roundId),
    index("commits_song_idx").on(t.songId),
    index("commits_contributor_idx").on(t.contributorId),
    uniqueIndex("commits_round_contributor_uq").on(t.roundId, t.contributorId),
  ],
);

export const votesTable = pgTable(
  "votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    commitId: uuid("commit_id")
      .notNull()
      .references(() => commitsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("votes_voter_commit_uq").on(t.voterId, t.commitId),
    index("votes_commit_idx").on(t.commitId),
  ],
);

export const versionsTable = pgTable(
  "versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    officialMixUrl: text("official_mix_url").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("versions_song_number_uq").on(t.songId, t.versionNumber),
    index("versions_song_idx").on(t.songId),
  ],
);

export const versionMergesTable = pgTable(
  "version_merges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => versionsTable.id, { onDelete: "cascade" }),
    commitId: uuid("commit_id")
      .notNull()
      .references(() => commitsTable.id, { onDelete: "restrict" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "restrict" }),
    mergeNote: text("merge_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("version_merges_version_commit_uq").on(t.versionId, t.commitId),
    index("version_merges_version_idx").on(t.versionId),
  ],
);

export const commentsTable = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("comments_song_idx").on(t.songId),
    index("comments_author_idx").on(t.authorId),
  ],
);

export const commitDraftsTable = pgTable(
  "commit_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    note: text("note"),
    instrumentType: text("instrument_type").notNull(),
    audioFileUrl: text("audio_file_url").notNull(),
    overlayOffsetSeconds: real("overlay_offset_seconds").notNull().default(0),
    displayNameOverride: text("display_name_override"),
    socialHandle: text("social_handle"),
    confirmedHumanMade: boolean("confirmed_human_made").notNull().default(false),
    confirmedRightsGrant: boolean("confirmed_rights_grant")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("commit_drafts_song_idx").on(t.songId),
    index("commit_drafts_contributor_idx").on(t.contributorId),
  ],
);

export const songCreditsTable = pgTable(
  "song_credits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    author: text("author").notNull(),
    sourceUrl: text("source_url").notNull(),
    licenseName: text("license_name").notNull(),
    licenseUrl: text("license_url").notNull(),
    role: text("role"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("song_credits_song_idx").on(t.songId)],
);

export const downloadsLogTable = pgTable(
  "downloads_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songsTable.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => songFilesTable.id, { onDelete: "cascade" }),
    downloaderId: uuid("downloader_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("downloads_song_idx").on(t.songId),
    index("downloads_file_idx").on(t.fileId),
  ],
);

export const commentReportsTable = pgTable(
  "comment_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => commentsTable.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("comment_reports_comment_reporter_uq").on(
      t.commentId,
      t.reporterId,
    ),
    index("comment_reports_comment_idx").on(t.commentId),
  ],
);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profilesTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    linkPath: text("link_path").notNull(),
    actorId: uuid("actor_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    songId: uuid("song_id").references(() => songsTable.id, {
      onDelete: "cascade",
    }),
    commentId: uuid("comment_id").references(() => commentsTable.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_user_unread_idx").on(t.userId, t.readAt),
  ],
);

export const adminActionsTable = pgTable("admin_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => profilesTable.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  payload: text("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Relations

export const songsRelations = relations(songsTable, ({ many, one }) => ({
  files: many(songFilesTable),
  rounds: many(roundsTable),
  commits: many(commitsTable),
  versions: many(versionsTable),
  credits: many(songCreditsTable),
  currentVersion: one(versionsTable, {
    fields: [songsTable.currentVersionId],
    references: [versionsTable.id],
  }),
}));

export const songCreditsRelations = relations(songCreditsTable, ({ one }) => ({
  song: one(songsTable, {
    fields: [songCreditsTable.songId],
    references: [songsTable.id],
  }),
}));

export const roundsRelations = relations(roundsTable, ({ one, many }) => ({
  song: one(songsTable, {
    fields: [roundsTable.songId],
    references: [songsTable.id],
  }),
  commits: many(commitsTable),
}));

export const commitsRelations = relations(commitsTable, ({ one, many }) => ({
  song: one(songsTable, {
    fields: [commitsTable.songId],
    references: [songsTable.id],
  }),
  round: one(roundsTable, {
    fields: [commitsTable.roundId],
    references: [roundsTable.id],
  }),
  contributor: one(profilesTable, {
    fields: [commitsTable.contributorId],
    references: [profilesTable.id],
  }),
  votes: many(votesTable),
  merges: many(versionMergesTable),
}));

export const votesRelations = relations(votesTable, ({ one }) => ({
  voter: one(profilesTable, {
    fields: [votesTable.voterId],
    references: [profilesTable.id],
  }),
  commit: one(commitsTable, {
    fields: [votesTable.commitId],
    references: [commitsTable.id],
  }),
}));

export const versionsRelations = relations(versionsTable, ({ one, many }) => ({
  song: one(songsTable, {
    fields: [versionsTable.songId],
    references: [songsTable.id],
  }),
  merges: many(versionMergesTable),
}));

export const versionMergesRelations = relations(
  versionMergesTable,
  ({ one }) => ({
    version: one(versionsTable, {
      fields: [versionMergesTable.versionId],
      references: [versionsTable.id],
    }),
    commit: one(commitsTable, {
      fields: [versionMergesTable.commitId],
      references: [commitsTable.id],
    }),
    contributor: one(profilesTable, {
      fields: [versionMergesTable.contributorId],
      references: [profilesTable.id],
    }),
  }),
);

// Ensure timestamps update on mutation where appropriate
export const __nowHelper = sql`now()`;

export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = typeof profilesTable.$inferInsert;
export type Song = typeof songsTable.$inferSelect;
export type InsertSong = typeof songsTable.$inferInsert;
export type SongFile = typeof songFilesTable.$inferSelect;
export type InsertSongFile = typeof songFilesTable.$inferInsert;
export type Round = typeof roundsTable.$inferSelect;
export type InsertRound = typeof roundsTable.$inferInsert;
export type Commit = typeof commitsTable.$inferSelect;
export type InsertCommit = typeof commitsTable.$inferInsert;
export type Vote = typeof votesTable.$inferSelect;
export type Version = typeof versionsTable.$inferSelect;
export type InsertVersion = typeof versionsTable.$inferInsert;
export type VersionMerge = typeof versionMergesTable.$inferSelect;
export type SongCredit = typeof songCreditsTable.$inferSelect;
export type InsertSongCredit = typeof songCreditsTable.$inferInsert;
export type Comment = typeof commentsTable.$inferSelect;
export type InsertComment = typeof commentsTable.$inferInsert;
export type CommitDraft = typeof commitDraftsTable.$inferSelect;
export type InsertCommitDraft = typeof commitDraftsTable.$inferInsert;
export type CommentReport = typeof commentReportsTable.$inferSelect;
export type InsertCommentReport = typeof commentReportsTable.$inferInsert;
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
