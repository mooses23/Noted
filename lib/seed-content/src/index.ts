/**
 * Shared metadata for the seeded "The Long Room" demo song.
 *
 * The audio used in the demo is sourced from Wikimedia Commons under
 * Creative Commons Attribution 3.0 Unported (CC BY 3.0). The CC BY license
 * requires visible attribution wherever the work is presented, so this list
 * is consumed by both the seed script (which uploads the files) and the
 * LayerStack song page (which renders the credits to end users).
 */

export const DEMO_SONG_SLUG = "the-long-room";

export const CC_BY_3_LICENSE = {
  name: "CC BY 3.0",
  url: "https://creativecommons.org/licenses/by/3.0/",
} as const;

export type DemoSongCredit = {
  /** Storage key relative to PRIVATE_OBJECT_DIR (e.g. "seed/the-long-room-v1.mp3"). */
  key: string;
  /** Track title as it appears on Wikimedia Commons. */
  title: string;
  /** Author / performer of the recording. */
  author: string;
  /** Wikimedia Commons file page (used as the human-facing source link). */
  sourcePage: string;
};

export const DEMO_SONG_CREDITS: DemoSongCredit[] = [
  {
    key: "seed/the-long-room-v1.mp3",
    title: "Evening Fall (Piano)",
    author: "Kevin MacLeod (incompetech.com)",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Evening_Fall_(Piano)_(ISRC_USUAN1100235).mp3",
  },
  {
    key: "seed/the-long-room-v2.mp3",
    title: "Crinoline Dreams",
    author: "Kevin MacLeod (incompetech.com)",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Crinoline_Dreams_(ISRC_USUAN1700073).mp3",
  },
  {
    key: "seed/stem-piano.mp3",
    title: "Evening Fall (Piano)",
    author: "Kevin MacLeod (incompetech.com)",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Evening_Fall_(Piano)_(ISRC_USUAN1100235).mp3",
  },
  {
    key: "seed/stem-vocal.mp3",
    title: "Amazing Grace 2011",
    author: "Kevin MacLeod (incompetech.com)",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Amazing_Grace_2011_(ISRC_USUAN1100820).mp3",
  },
  {
    key: "seed/click-72.mp3",
    title: "Heart is metronome",
    author: "Antti Luode",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Heart_is_metronome_(Antti_Luode).mp3",
  },
  {
    key: "seed/commit-jules-bass.mp3",
    title: "Bassy Bass",
    author: "Antti Luode",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Bassy_Bass_(Antti_Luode).mp3",
  },
  {
    key: "seed/commit-kenji-drums.mp3",
    title: "Sleeping Drum",
    author: "Antti Luode",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Sleeping_Drum_(Antti_Luode).mp3",
  },
  {
    key: "seed/commit-sade-drums.mp3",
    title: "Bang A Drum",
    author: "Antti Luode",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Bang_A_Drum_(Antti_Luode).mp3",
  },
  {
    key: "seed/commit-thiago-drums.mp3",
    title: "Jamming with a drum machine",
    author: "Antti Luode",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Jamming_with_a_drum_machine_(Antti_Luode).mp3",
  },
  {
    key: "seed/commit-ilse-drums.mp3",
    title: "Rock Drums",
    author: "Antti Luode",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Rock_Drums_(Antti_Luode).mp3",
  },
  {
    key: "seed/commit-dmitri-drums.mp3",
    title: "Soul Of A Drum Machine",
    author: "Antti Luode",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Soul_Of_A_Drum_Machine_(Antti_Luode).mp3",
  },
];

export function formatCreditLine(credit: DemoSongCredit): string {
  return `"${credit.title}" \u2014 ${credit.author}, ${CC_BY_3_LICENSE.name}`;
}

/**
 * Site-wide registry of third-party assets that require attribution.
 *
 * To add a new attributable asset (cover image, font, icon set, sound effect,
 * etc.), append a single entry below. The /licenses page renders this list
 * grouped by `category`, so no UI changes are required.
 */
export type LicenseRef = {
  name: string;
  url: string;
};

export type ThirdPartyAsset = {
  /** Stable id used as React key. */
  id: string;
  /** Grouping label, e.g. "Demo Song Audio", "Icons", "Fonts". */
  category: string;
  /** Asset title as it appears at the source. */
  title: string;
  /** Author / creator / maintainer. */
  author: string;
  /** Where / how the asset is used in LayerStack. */
  usage: string;
  /** Public URL to the asset's source / info page. */
  sourceUrl: string;
  /** License the asset is distributed under. */
  license: LicenseRef;
};

export const THIRD_PARTY_ASSETS: ThirdPartyAsset[] = [
  ...DEMO_SONG_CREDITS.map<ThirdPartyAsset>((credit) => ({
    id: `demo-audio:${credit.key}`,
    category: "Demo Song Audio",
    title: credit.title,
    author: credit.author,
    usage: `Used as ${credit.key.replace(/^seed\//, "")} in "The Long Room" demo song.`,
    sourceUrl: credit.sourcePage,
    license: CC_BY_3_LICENSE,
  })),
  {
    id: "icons:lucide",
    category: "Icons",
    title: "Lucide Icons",
    author: "Lucide contributors",
    usage: "UI iconography across the LayerStack web app.",
    sourceUrl: "https://lucide.dev/",
    license: {
      name: "ISC License",
      url: "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
    },
  },
  {
    id: "fonts:geist",
    category: "Fonts",
    title: "Geist",
    author: "Vercel",
    usage: "Primary sans-serif typeface used throughout the interface.",
    sourceUrl: "https://vercel.com/font",
    license: {
      name: "SIL Open Font License 1.1",
      url: "https://github.com/vercel/geist-font/blob/main/LICENSE.TXT",
    },
  },
];
