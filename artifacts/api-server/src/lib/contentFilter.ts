// Lightweight content checks for user-posted comments. Goal is to block
// the cheapest spam patterns (link floods, repeated chars, obvious
// profanity) without becoming a moderation engine. Anything ambiguous is
// allowed and surfaced to admins via the report queue.

const URL_RE = /\bhttps?:\/\/\S+/gi;
const MAX_URLS = 2;

const PROFANITY_BLOCKLIST = new Set<string>([
  // Conservative starter list — words whose only common use is abusive.
  // Everything else falls through to user reports + admin review.
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "cunt",
  "nigger",
  "faggot",
  "retard",
]);

const REPEAT_RE = /(.)\1{9,}/; // 10+ of the same char
const ALLCAPS_THRESHOLD = 0.85; // 85%+ uppercase letters with length >= 20

export type ContentCheck =
  | { ok: true; sanitized: string }
  | { ok: false; reason: string };

export function checkCommentContent(rawBody: string): ContentCheck {
  const sanitized = rawBody.trim().replace(/[ \t]+/g, " ");

  if (sanitized.length === 0) {
    return { ok: false, reason: "Comment cannot be empty" };
  }

  const urls = sanitized.match(URL_RE) ?? [];
  if (urls.length > MAX_URLS) {
    return {
      ok: false,
      reason: `Too many links (max ${MAX_URLS}). Trim some and try again.`,
    };
  }

  if (REPEAT_RE.test(sanitized)) {
    return {
      ok: false,
      reason: "Please don't spam repeated characters.",
    };
  }

  const letters = sanitized.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 20) {
    const upper = letters.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length >= ALLCAPS_THRESHOLD) {
      return {
        ok: false,
        reason: "Please don't post in all caps.",
      };
    }
  }

  const tokens = sanitized
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
  for (const t of tokens) {
    if (PROFANITY_BLOCKLIST.has(t)) {
      return {
        ok: false,
        reason: "Comment contains language we don't allow.",
      };
    }
  }

  return { ok: true, sanitized };
}
