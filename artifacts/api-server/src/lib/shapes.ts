import {
  type Song,
  type SongFile,
  type Round,
  type Commit,
  type Version,
  type Profile,
  type SongCredit,
} from "@workspace/db";

export const toSong = (s: Song) => ({
  id: s.id,
  slug: s.slug,
  title: s.title,
  description: s.description ?? null,
  coverImageUrl: s.coverImageUrl ?? null,
  creatorName: s.creatorName,
  genre: s.genre,
  bpm: s.bpm,
  musicalKey: s.musicalKey,
  timeSignature: s.timeSignature ?? null,
  status: s.status,
  phase: s.phase,
  currentVersionId: s.currentVersionId ?? null,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const toSongFile = (f: SongFile) => ({
  id: f.id,
  songId: f.songId,
  fileType: f.fileType,
  label: f.label,
  fileUrl: f.fileUrl,
  originalFilename: f.originalFilename,
  sizeBytes: f.sizeBytes ?? null,
  createdAt: f.createdAt.toISOString(),
});

export const toRound = (
  r: Round,
  extras?: { commitCount?: number; totalVotes?: number },
) => ({
  id: r.id,
  songId: r.songId,
  roundNumber: r.roundNumber,
  title: r.title,
  description: r.description ?? null,
  allowedInstrumentType: r.allowedInstrumentType,
  kind: r.kind,
  mergeBehavior: r.mergeBehavior,
  status: r.status,
  opensAt: r.opensAt ? r.opensAt.toISOString() : null,
  closesAt: r.closesAt ? r.closesAt.toISOString() : null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  commitCount: extras?.commitCount ?? null,
  totalVotes: extras?.totalVotes ?? null,
});

export const toVersion = (v: Version) => ({
  id: v.id,
  songId: v.songId,
  versionNumber: v.versionNumber,
  title: v.title,
  description: v.description ?? null,
  officialMixUrl: v.officialMixUrl,
  isCurrent: v.isCurrent,
  createdAt: v.createdAt.toISOString(),
});

export const toSongCredit = (c: SongCredit) => ({
  id: c.id,
  songId: c.songId,
  title: c.title,
  author: c.author,
  sourceUrl: c.sourceUrl,
  licenseName: c.licenseName,
  licenseUrl: c.licenseUrl,
  role: c.role ?? null,
  sortOrder: c.sortOrder,
  createdAt: c.createdAt.toISOString(),
});

export const toContributor = (p: Profile) => ({
  id: p.id,
  displayName: p.displayName,
  username: p.username ?? null,
  avatarUrl: p.avatarUrl ?? null,
  socialHandle: p.socialHandle ?? null,
});

export const toProfile = (p: Profile) => ({
  id: p.id,
  displayName: p.displayName,
  username: p.username ?? null,
  avatarUrl: p.avatarUrl ?? null,
  bio: p.bio ?? null,
  socialHandle: p.socialHandle ?? null,
  isAdmin: p.isAdmin,
  createdAt: p.createdAt.toISOString(),
});

export type CommitRow = {
  commit: Commit;
  contributor: Profile;
  song: Song;
  round: Round;
  voteCount: number;
  hasVoted: boolean;
  baseAudioUrl: string | null;
};

export const toCommitSummary = (r: CommitRow) => ({
  id: r.commit.id,
  songId: r.commit.songId,
  roundId: r.commit.roundId,
  contributorId: r.commit.contributorId,
  title: r.commit.title,
  note: r.commit.note ?? null,
  instrumentType: r.commit.instrumentType,
  kind: r.commit.kind,
  audioFileUrl: r.commit.audioFileUrl,
  previewMixUrl: r.commit.previewMixUrl ?? null,
  overlayOffsetSeconds: r.commit.overlayOffsetSeconds ?? 0,
  baseAudioUrl: r.baseAudioUrl ?? null,
  status: r.commit.status,
  voteCount: r.voteCount,
  hasVoted: r.hasVoted,
  createdAt: r.commit.createdAt.toISOString(),
  contributor: toContributor(r.contributor),
  roundNumber: r.round.roundNumber,
  songTitle: r.song.title,
  songSlug: r.song.slug,
  songGenre: r.song.genre,
});
