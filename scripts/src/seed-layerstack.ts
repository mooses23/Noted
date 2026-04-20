import {
  db,
  profilesTable,
  songsTable,
  songFilesTable,
  roundsTable,
  commitsTable,
  votesTable,
  versionsTable,
  versionMergesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding LayerStack...");

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
        sizeBytes: 4_800_000,
      },
      {
        songId,
        fileType: "stem",
        label: "Piano (L/R)",
        fileUrl: "/objects/seed/stem-piano.wav",
        originalFilename: "stem-piano.wav",
        sizeBytes: 18_200_000,
      },
      {
        songId,
        fileType: "stem",
        label: "Lead Vocal",
        fileUrl: "/objects/seed/stem-vocal.wav",
        originalFilename: "stem-vocal.wav",
        sizeBytes: 14_100_000,
      },
      {
        songId,
        fileType: "click",
        label: "Click @ 72 bpm",
        fileUrl: "/objects/seed/click-72.wav",
        originalFilename: "click-72.wav",
        sizeBytes: 3_400_000,
      },
    ]);
  }

  // 5. Round 1 — already merged (bass)
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
        status: "merged",
        opensAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
        closesAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      })
      .returning();
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
        audioFileUrl: "/objects/seed/commit-jules-bass.wav",
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
        officialMixUrl: "/objects/seed/the-long-room-v2.mp3",
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
        status: "open",
        opensAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
      })
      .returning();
  }

  // 8. Five mock drum commits
  const drumSubmissions = [
    {
      contributor: kenji!,
      title: "Brushes, tea-cup tempo",
      note: "Tried to match the breath of the vocal. 72 bpm, brushes on a felted snare.",
      url: "/objects/seed/commit-kenji-drums.wav",
    },
    {
      contributor: sade!,
      title: "Felt mallets on a floor tom",
      note: "No hats, no snare. Just a heartbeat underneath.",
      url: "/objects/seed/commit-sade-drums.wav",
    },
    {
      contributor: thiago!,
      title: "Cajón + shakers",
      note: "For when it needs to feel a little warmer.",
      url: "/objects/seed/commit-thiago-drums.wav",
    },
    {
      contributor: ilse!,
      title: "Light sticks, ride-forward",
      note: "Old Zildjian A, played with the shoulder of the stick.",
      url: "/objects/seed/commit-ilse-drums.wav",
    },
    {
      contributor: dmitri!,
      title: "Minimal — kick, closed hat, rim",
      note: "Only where it has to be there. Leaves space for strings later.",
      url: "/objects/seed/commit-dmitri-drums.wav",
    },
  ];

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
          audioFileUrl: s.url,
          status: "pending",
          confirmedHumanMade: true,
          confirmedRightsGrant: true,
        })
        .returning();
      drumCommits.push(c!);
    }
  } else {
    drumCommits.push(...existingDrumCommits);
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

  console.log("✓ Seed complete");
  console.log(`  Song: ${song!.title} (slug: ${slug})`);
  console.log(`  Profiles: ${profiles.length}`);
  console.log(`  Round 2 is OPEN for drums.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
