import {
  db,
  profilesTable,
  songsTable,
  songFilesTable,
  songCreditsTable,
  roundsTable,
  commitsTable,
  votesTable,
  versionsTable,
  versionMergesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadSeedAudio } from "./lib/seed-audio";
import { DEMO_SONG_CREDITS, CC_BY_3_LICENSE } from "@workspace/seed-content";

async function main() {
  console.log("Seeding Noted...");

  await uploadSeedAudio();

  // 1. Profiles
  const profileSeeds = [
    { displayName: "Mara Rowan", username: "mararowan", socialHandle: "@mararowan", bio: "Producer, Lisbon. Tape machines and broken synths.", isAdmin: true },
    { displayName: "Jules Farrow", username: "julesfarrow", socialHandle: "@julesfarrow", bio: "Upright bass. Mostly late nights." },
    { displayName: "Kenji Oshima", username: "kenji.o", socialHandle: "@kenji.o", bio: "Drummer. Cymbals mostly ride Zildjians from 1974." },
    { displayName: "Ilse Van Damme", username: "ilsevd", socialHandle: "@ilsevd", bio: "Vocalist, Antwerp." },
    { displayName: "Dmitri Volkov", username: "dvolkov", socialHandle: "@dvolkov", bio: "Strings. Cello first, violin sometimes." },
    { displayName: "Sade Okonkwo", username: "sade.ok", socialHandle: "@sade.ok", bio: "Keys, analog warmth." },
    { displayName: "Thiago Moraes", username: "thiagomoraes", socialHandle: "@thiagomoraes", bio: "Guitar, flamenco roots." },
    { displayName: "Alex Petrov", username: "alex.p", socialHandle: "@alex.p", bio: "Listener. Votes with intention." },
  ];

  const profiles: { id: string; displayName: string }[] = [];
  for (const p of profileSeeds) {
    const [existing] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.displayName, p.displayName))
      .limit(1);
    if (existing) {
      profiles.push(existing);
    } else {
      const [created] = await db.insert(profilesTable).values(p).returning();
      profiles.push(created!);
    }
  }
  const [mara, jules, kenji, ilse, dmitri, sade, thiago, alex] = profiles;

  // 2. Song
  const slug = "the-long-room";
  let [song] = await db.select().from(songsTable).where(eq(songsTable.slug, slug)).limit(1);
  if (!song) {
    [song] = await db
      .insert(songsTable)
      .values({
        slug,
        title: "The Long Room",
        description:
          "A slow-burning piece built in real time by a community of musicians. Starts with a piano sketch and a vocal melody — where it goes is up to you.",
        creatorName: "Mara Rowan",
        genre: "Experimental Folk",
        bpm: 72,
        musicalKey: "D minor",
        timeSignature: "4/4",
        status: "active",
        featured: true,
      })
      .returning();
  }
  const songId = song!.id;

  // Ensure a seeded cover URL is attached to the song record.
  const seededCoverUrl = `/objects/songs/${songId}/cover/the-long-room-cover.jpg`;
  if (song!.coverImageUrl !== seededCoverUrl) {
    await db
      .update(songsTable)
      .set({ coverImageUrl: seededCoverUrl, updatedAt: new Date() })
      .where(eq(songsTable.id, songId));
    song!.coverImageUrl = seededCoverUrl;
  }

  // 3. Version 1 — the seed
  let [v1] = await db
    .select()
    .from(versionsTable)
    .where(eq(versionsTable.songId, songId))
    .limit(1);
  if (!v1) {
    [v1] = await db
      .insert(versionsTable)
      .values({
        songId,
        versionNumber: 1,
        title: "v1 — Seed",
        description: "Piano sketch + lead vocal. Posted by Mara Rowan as a starting point.",
        officialMixUrl: "/objects/seed/the-long-room-v1.mp3",
        isCurrent: false,
      })
      .returning();
    // The v1 mix is "Evening Fall (Piano)" by Kevin MacLeod, CC BY 3.0
    // (see scripts/src/lib/seed-audio-credits.md).
    await db
      .update(songsTable)
      .set({ currentVersionId: v1!.id })
      .where(eq(songsTable.id, songId));
  }

  // 4. Song files (stems + preview)
  const existingFiles = await db
    .select()
    .from(songFilesTable)
    .where(eq(songFilesTable.songId, songId));
  if (existingFiles.length === 0) {
    await db.insert(songFilesTable).values([
      {
        songId,
        fileType: "cover",
        label: "Cover art",
        fileUrl: `/objects/songs/${songId}/cover/the-long-room-cover.jpg`,
        originalFilename: "the-long-room-cover.jpg",
        sizeBytes: 420_000,
      },
      {
        songId,
        fileType: "preview",
        label: "Current mix — v1",
        fileUrl: "/objects/seed/the-long-room-v1.mp3",
        originalFilename: "the-long-room-v1.mp3",
        sizeBytes: 5_397_796,
      },
      {
        songId,
        fileType: "stem",
        label: "Piano (L/R)",
        fileUrl: "/objects/seed/stem-piano.mp3",
        originalFilename: "stem-piano.mp3",
        sizeBytes: 5_397_796,
      },
      {
        songId,
        fileType: "stem",
        label: "Lead Vocal",
        fileUrl: "/objects/seed/stem-vocal.mp3",
        originalFilename: "stem-vocal.mp3",
        sizeBytes: 7_572_292,
      },
      {
        songId,
        fileType: "click",
        label: "Click @ 72 bpm",
        fileUrl: "/objects/seed/click-72.mp3",
        originalFilename: "click-72.mp3",
        sizeBytes: 3_542_354,
      },
    ]);
  }

  // 5. Round 1 — already merged (bass). Submitted against v1.
  let [round1] = await db
    .select()
    .from(roundsTable)
    .where(eq(roundsTable.songId, songId))
    .limit(1);
  if (!round1) {
    [round1] = await db
      .insert(roundsTable)
      .values({
        songId,
        roundNumber: 1,
        title: "Round 1 — Bass",
        description: "Lay down the low end. Upright, electric, sub — whatever fits.",
        allowedInstrumentType: "bass",
        kind: "structure",
        mergeBehavior: "single",
        status: "merged",
        baseVersionId: v1!.id,
        opensAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
        closesAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      })
      .returning();
  } else if (!round1.baseVersionId) {
    await db
      .update(roundsTable)
      .set({ baseVersionId: v1!.id, updatedAt: new Date() })
      .where(eq(roundsTable.id, round1.id));
    round1.baseVersionId = v1!.id;
  }

  // A merged bass commit by Jules
  let [julesCommit] = await db
    .select()
    .from(commitsTable)
    .where(eq(commitsTable.roundId, round1!.id))
    .limit(1);
  if (!julesCommit) {
    [julesCommit] = await db
      .insert(commitsTable)
      .values({
        songId,
        roundId: round1!.id,
        contributorId: jules!.id,
        title: "Upright, walking under the verses",
        note: "Tried to stay out of the way of the piano. One take, a little breath on the low D.",
        instrumentType: "bass",
        kind: "structure",
        audioFileUrl: "/objects/seed/commit-jules-bass.mp3",
        previewMixUrl: "/objects/seed/the-long-room-v2.mp3",
        status: "merged",
        confirmedHumanMade: true,
        confirmedRightsGrant: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      })
      .returning();
  }

  // 6. Version 2 — merged bass
  let [v2] = await db
    .select()
    .from(versionsTable)
    .where(eq(versionsTable.songId, songId))
    .limit(2)
    .then((rows) => rows.filter((r) => r.versionNumber === 2));
  if (!v2) {
    await db
      .update(versionsTable)
      .set({ isCurrent: false })
      .where(eq(versionsTable.songId, songId));
    [v2] = await db
      .insert(versionsTable)
      .values({
        songId,
        versionNumber: 2,
        title: "v2 — Bass in",
        description: "Jules's upright. Felt like it had always been there.",
        officialMixUrl: "/objects/seed/the-long-room-v2.mp3", // "Crinoline Dreams" — Kevin MacLeod, CC BY 3.0
        isCurrent: true,
      })
      .returning();
    await db.insert(versionMergesTable).values({
      versionId: v2!.id,
      commitId: julesCommit!.id,
      contributorId: jules!.id,
      mergeNote: "Locked in against the piano. No edits beyond a light high-pass.",
    });
    await db
      .update(songsTable)
      .set({ currentVersionId: v2!.id, updatedAt: new Date() })
      .where(eq(songsTable.id, songId));
  }

  // 7. Round 2 — OPEN, drums
  const allRounds = await db
    .select()
    .from(roundsTable)
    .where(eq(roundsTable.songId, songId));
  let round2 = allRounds.find((r) => r.roundNumber === 2);
  if (!round2) {
    [round2] = await db
      .insert(roundsTable)
      .values({
        songId,
        roundNumber: 2,
        title: "Round 2 — Drums",
        description:
          "Brushes or sticks — your call. Keep the room in it. No triggers, no samples.",
        allowedInstrumentType: "drums",
        kind: "structure",
        mergeBehavior: "single",
        status: "open",
        baseVersionId: v2!.id,
        opensAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
      })
      .returning();
  } else if (!round2.baseVersionId) {
    await db
      .update(roundsTable)
      .set({ baseVersionId: v2!.id, updatedAt: new Date() })
      .where(eq(roundsTable.id, round2.id));
    round2.baseVersionId = v2!.id;
  }

  // 8. Five mock drum commits
  const drumSubmissions = [
    {
      contributor: kenji!,
      title: "Brushes, tea-cup tempo",
      note: "Tried to match the breath of the vocal. 72 bpm, brushes on a felted snare.",
      url: "/objects/seed/commit-kenji-drums.mp3",
    },
    {
      contributor: sade!,
      title: "Felt mallets on a floor tom",
      note: "No hats, no snare. Just a heartbeat underneath.",
      url: "/objects/seed/commit-sade-drums.mp3",
    },
    {
      contributor: thiago!,
      title: "Cajón + shakers",
      note: "For when it needs to feel a little warmer.",
      url: "/objects/seed/commit-thiago-drums.mp3",
    },
    {
      contributor: ilse!,
      title: "Light sticks, ride-forward",
      note: "Old Zildjian A, played with the shoulder of the stick.",
      url: "/objects/seed/commit-ilse-drums.mp3",
    },
    {
      contributor: dmitri!,
      title: "Minimal — kick, closed hat, rim",
      note: "Only where it has to be there. Leaves space for strings later.",
      url: "/objects/seed/commit-dmitri-drums.mp3",
    },
  ];

  // Placeholder layered preview for drum commits (CC BY 3.0 stand-in: v1 mix).
  // We don't actually render drum-layered audio at seed time — this gives the
  // comparator something audibly distinct from the v2 base mix to play.
  const drumLayeredPlaceholder = "/objects/seed/the-long-room-v1.mp3";

  const existingDrumCommits = await db
    .select()
    .from(commitsTable)
    .where(eq(commitsTable.roundId, round2!.id));
  const drumCommits: { id: string; contributorId: string }[] = [];
  if (existingDrumCommits.length === 0) {
    for (const s of drumSubmissions) {
      const [c] = await db
        .insert(commitsTable)
        .values({
          songId,
          roundId: round2!.id,
          contributorId: s.contributor.id,
          title: s.title,
          note: s.note,
          instrumentType: "drums",
          kind: "structure",
          audioFileUrl: s.url,
          previewMixUrl: drumLayeredPlaceholder,
          status: "pending",
          confirmedHumanMade: true,
          confirmedRightsGrant: true,
        })
        .returning();
      drumCommits.push(c!);
    }
  } else {
    for (const c of existingDrumCommits) {
      if (!c.previewMixUrl) {
        await db
          .update(commitsTable)
          .set({ previewMixUrl: drumLayeredPlaceholder, updatedAt: new Date() })
          .where(eq(commitsTable.id, c.id));
      }
      drumCommits.push(c);
    }
  }

  // Backfill jules's bass commit previewMixUrl (v2 mix actually contains the bass).
  if (julesCommit && !julesCommit.previewMixUrl) {
    await db
      .update(commitsTable)
      .set({
        previewMixUrl: "/objects/seed/the-long-room-v2.mp3",
        updatedAt: new Date(),
      })
      .where(eq(commitsTable.id, julesCommit.id));
  }

  // 9. Seed votes — distribute
  const voters = [mara!, jules!, kenji!, ilse!, dmitri!, sade!, thiago!, alex!];
  const existingVotes = await db.select().from(votesTable);
  if (existingVotes.length === 0) {
    // Kenji's gets the most love
    const voteMap: [number, (typeof voters)[number][]][] = [
      [0, [mara!, ilse!, sade!, thiago!, alex!, dmitri!]], // Kenji
      [1, [mara!, thiago!, kenji!]],                        // Sade
      [2, [jules!, ilse!, alex!]],                          // Thiago
      [3, [mara!, sade!]],                                   // Ilse
      [4, [alex!]],                                          // Dmitri
    ];
    for (const [idx, vs] of voteMap) {
      const commit = drumCommits[idx];
      if (!commit) continue;
      for (const v of vs) {
        if (v.id === commit.contributorId) continue;
        await db
          .insert(votesTable)
          .values({ voterId: v.id, commitId: commit.id })
          .onConflictDoNothing();
      }
    }
  }

  // 9b. Third-party credits for the demo song (idempotent)
  const existingCredits = await db
    .select()
    .from(songCreditsTable)
    .where(eq(songCreditsTable.songId, songId));
  if (existingCredits.length === 0) {
    await db.insert(songCreditsTable).values(
      DEMO_SONG_CREDITS.map((c, idx) => ({
        songId,
        title: c.title,
        author: c.author,
        sourceUrl: c.sourcePage,
        licenseName: CC_BY_3_LICENSE.name,
        licenseUrl: CC_BY_3_LICENSE.url,
        role: c.key.replace(/^seed\//, ""),
        sortOrder: idx,
      })),
    );
  }

  // 9c. Second demo song — already in the accents phase, with an open accent round.
  await seedAccentsPhaseDemo({ mara: mara!, jules: jules!, kenji: kenji!, ilse: ilse!, sade: sade!, thiago: thiago!, alex: alex! });

  // 10. URL sync — keep seeded rows pointing at the current .mp3 storage keys
  //     even if a prior run wrote .wav URLs.
  const urlSyncs: Array<[string, string]> = [
    ["seed/the-long-room-v1.mp3", "/objects/seed/the-long-room-v1.mp3"],
    ["seed/the-long-room-v2.mp3", "/objects/seed/the-long-room-v2.mp3"],
    ["seed/stem-piano",  "/objects/seed/stem-piano.mp3"],
    ["seed/stem-vocal",  "/objects/seed/stem-vocal.mp3"],
    ["seed/click-72",    "/objects/seed/click-72.mp3"],
    ["seed/commit-jules-bass",   "/objects/seed/commit-jules-bass.mp3"],
    ["seed/commit-kenji-drums",  "/objects/seed/commit-kenji-drums.mp3"],
    ["seed/commit-sade-drums",   "/objects/seed/commit-sade-drums.mp3"],
    ["seed/commit-thiago-drums", "/objects/seed/commit-thiago-drums.mp3"],
    ["seed/commit-ilse-drums",   "/objects/seed/commit-ilse-drums.mp3"],
    ["seed/commit-dmitri-drums", "/objects/seed/commit-dmitri-drums.mp3"],
  ];
  const allFiles = await db.select().from(songFilesTable);
  for (const f of allFiles) {
    for (const [stem, target] of urlSyncs) {
      if (f.fileUrl?.includes(stem) && f.fileUrl !== target) {
        await db.update(songFilesTable).set({ fileUrl: target }).where(eq(songFilesTable.id, f.id));
        break;
      }
    }
  }
  const allCommits = await db.select().from(commitsTable);
  for (const c of allCommits) {
    for (const [stem, target] of urlSyncs) {
      if (c.audioFileUrl?.includes(stem) && c.audioFileUrl !== target) {
        await db.update(commitsTable).set({ audioFileUrl: target }).where(eq(commitsTable.id, c.id));
        break;
      }
    }
  }
  const allVersions = await db.select().from(versionsTable);
  for (const v of allVersions) {
    for (const [stem, target] of urlSyncs) {
      if (v.officialMixUrl?.includes(stem) && v.officialMixUrl !== target) {
        await db.update(versionsTable).set({ officialMixUrl: target }).where(eq(versionsTable.id, v.id));
        break;
      }
    }
  }

  console.log("✓ Seed complete");
  console.log(`  Song: ${song!.title} (slug: ${slug}) — phase: structure`);
  console.log(`  Song: Ember & Iron (slug: ember-and-iron) — phase: accents`);
  console.log(`  Profiles: ${profiles.length}`);
  console.log(`  Round 2 of The Long Room is OPEN for drums.`);
  console.log(`  Ember & Iron has an OPEN accent round (claps & one-shots).`);
}

type Profile = { id: string; displayName: string };

async function seedAccentsPhaseDemo(p: {
  mara: Profile; jules: Profile; kenji: Profile; ilse: Profile;
  sade: Profile; thiago: Profile; alex: Profile;
}) {
  const slug = "ember-and-iron";
  let [song] = await db.select().from(songsTable).where(eq(songsTable.slug, slug)).limit(1);
  if (!song) {
    [song] = await db
      .insert(songsTable)
      .values({
        slug,
        title: "Ember & Iron",
        description:
          "Foundation is locked. Now we shape the signature moments — the claps, the stabs, the things that make a song feel inevitable.",
        creatorName: "Mara Rowan",
        genre: "Cinematic Folk",
        bpm: 84,
        musicalKey: "A minor",
        timeSignature: "4/4",
        status: "active",
        featured: false,
        phase: "accents",
      })
      .returning();
  } else if (song.phase !== "accents") {
    await db
      .update(songsTable)
      .set({ phase: "accents", updatedAt: new Date() })
      .where(eq(songsTable.id, song.id));
    song.phase = "accents";
  }
  const songId = song!.id;

  // Version 1 (foundation locked)
  const versions = await db.select().from(versionsTable).where(eq(versionsTable.songId, songId));
  let foundation = versions.find((v) => v.versionNumber === 1);
  if (!foundation) {
    [foundation] = await db
      .insert(versionsTable)
      .values({
        songId,
        versionNumber: 1,
        title: "v1 — Foundation locked",
        description: "Bass + drums merged. Structure phase complete.",
        officialMixUrl: "/objects/seed/the-long-room-v2.mp3",
        isCurrent: true,
      })
      .returning();
    await db
      .update(songsTable)
      .set({ currentVersionId: foundation!.id, updatedAt: new Date() })
      .where(eq(songsTable.id, songId));
  }

  // Two merged structure rounds (historical context)
  const existingRounds = await db.select().from(roundsTable).where(eq(roundsTable.songId, songId));
  if (existingRounds.length === 0) {
    await db.insert(roundsTable).values([
      {
        songId,
        roundNumber: 1,
        title: "Round 1 — Bass",
        description: "Foundation bass. Merged.",
        allowedInstrumentType: "bass",
        kind: "structure",
        mergeBehavior: "single",
        status: "merged",
        baseVersionId: foundation!.id,
        opensAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
        closesAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 24),
      },
      {
        songId,
        roundNumber: 2,
        title: "Round 2 — Drums",
        description: "Foundation drums. Merged.",
        allowedInstrumentType: "drums",
        kind: "structure",
        mergeBehavior: "single",
        status: "merged",
        baseVersionId: foundation!.id,
        opensAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21),
        closesAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
      },
    ]);
  }

  // Open accent round (multi-merge)
  const allRounds = await db.select().from(roundsTable).where(eq(roundsTable.songId, songId));
  let accentRound = allRounds.find((r) => r.roundNumber === 3);
  if (!accentRound) {
    [accentRound] = await db
      .insert(roundsTable)
      .values({
        songId,
        roundNumber: 3,
        title: "Round 3 — Claps & one-shots",
        description:
          "Signature moments only. Short takes, single hits, anything with character. Multiple winners may be merged.",
        allowedInstrumentType: "percussion",
        kind: "accent",
        mergeBehavior: "multi",
        status: "open",
        baseVersionId: foundation!.id,
        opensAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      })
      .returning();
  }

  // Mock accent commits — short / signature
  const accentSubmissions = [
    { contributor: p.kenji,  title: "808 clap, downbeats 2 & 4", url: "/objects/seed/commit-kenji-drums.mp3" },
    { contributor: p.sade,   title: "Rim snap, off-grid",        url: "/objects/seed/commit-sade-drums.mp3" },
    { contributor: p.thiago, title: "Hand-claps, room mic",      url: "/objects/seed/commit-thiago-drums.mp3" },
    { contributor: p.ilse,   title: "Ad-lib 'oh' on the turn",   url: "/objects/seed/commit-ilse-drums.mp3" },
  ];
  const existingAccentCommits = await db
    .select()
    .from(commitsTable)
    .where(eq(commitsTable.roundId, accentRound!.id));
  const accentCommits: { id: string; contributorId: string }[] = [];
  if (existingAccentCommits.length === 0) {
    for (const s of accentSubmissions) {
      const [c] = await db
        .insert(commitsTable)
        .values({
          songId,
          roundId: accentRound!.id,
          contributorId: s.contributor.id,
          title: s.title,
          instrumentType: "percussion",
          kind: "accent",
          audioFileUrl: s.url,
          previewMixUrl: "/objects/seed/the-long-room-v2.mp3",
          status: "pending",
          confirmedHumanMade: true,
          confirmedRightsGrant: true,
        })
        .returning();
      accentCommits.push(c!);
    }
  } else {
    for (const c of existingAccentCommits) accentCommits.push(c);
  }

  // Spread votes — accents tend to gather many, smaller bouquets
  const voters = [p.mara, p.jules, p.kenji, p.ilse, p.sade, p.thiago, p.alex];
  for (let i = 0; i < accentCommits.length; i++) {
    const commit = accentCommits[i];
    const pool = voters.slice(0, 3 + ((i * 2) % voters.length));
    for (const v of pool) {
      if (v.id === commit!.contributorId) continue;
      await db
        .insert(votesTable)
        .values({ voterId: v.id, commitId: commit!.id })
        .onConflictDoNothing();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
