import { createWorker, PSM, type Worker } from "tesseract.js";
import { tmpdir } from "os";

export type PaymentVerificationFailureReason =
  | "unreadable"
  | "amount_mismatch"
  | "shop_name_mismatch"
  | "datetime_out_of_window"
  | "duplicate_payment";

export type ExtractedPaymentFields = {
  utr: string | null;
  amount: number | null;
  amountCandidates: number[];
  dateTime: Date | null;
  rawText: string;
};

// A fresh worker pays for engine init + language-data loading on every call
// (several seconds). Keeping one warm worker around for the life of the
// server process means only the first request after a cold start pays that
// cost — every request after is just recognition time. tesseract.js queues
// concurrent recognize() calls on a worker internally, so this is safe
// under concurrent requests too.
let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    // Tesseract.js's default cache location is the process's current working
    // directory, which is fine on a local dev machine but read-only on
    // Vercel's serverless functions — pointing it at the OS temp dir (the
    // one writable path in that environment) keeps this working in
    // production instead of failing on every cold start.
    workerPromise = createWorker("eng", 1, { cachePath: tmpdir() })
      .then(async (worker) => {
        // Payment confirmation screens are sparse: a large icon, big gaps
        // of white space, then isolated blocks of text (amount, payee
        // name, timestamp) rather than dense paragraphs. Tesseract's
        // default page-segmentation mode is tuned for paragraph-style
        // documents and can skip an isolated text block entirely on a
        // layout like this (observed: a screenshot's amount line was
        // completely absent from the OCR output, not misread — the
        // segmentation step never found it as a text region at all).
        // SPARSE_TEXT is built for exactly this "scattered text on a
        // mostly-blank page" case.
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        return worker;
      })
      .catch((err) => {
        workerPromise = null; // let the next call retry instead of staying poisoned
        throw err;
      });
  }
  return workerPromise;
}

// A worker-thread crash inside Tesseract doesn't always surface as a
// rejected promise (it can just hang), which would otherwise leave the
// customer stuck until the platform's own function timeout kills the whole
// request. Racing against an explicit timeout guarantees this call always
// settles well before that, so the route can fail the order cleanly.
const OCR_TIMEOUT_MS = 20_000;

export async function runOcr(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const recognizePromise = worker.recognize(buffer).then((r) => r.data.text);
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error("OCR timed out")), OCR_TIMEOUT_MS)
  );
  return Promise.race([recognizePromise, timeoutPromise]);
}

// UPI apps label the transaction ID differently ("UPI transaction ID",
// "Google transaction ID", "UTR", "Ref No"...) and the ID length varies
// (9-16 digits is the common range across GPay/PhonePe/Paytm) — so we try
// a keyword-anchored match first, then fall back to any bare digit run in
// that range.
const UTR_KEYWORD_PATTERN =
  /(?:UPI transaction ID|Google transaction ID|UPI ref(?:erence)?\.?\s*(?:no|number)?|Transaction ID|Txn\.?\s*ID|UTR)[:\s]*([A-Za-z0-9]{9,25})/i;
const UTR_FALLBACK_PATTERN = /\b\d{9,16}\b/;

// The ₹/Rs symbol frequently gets dropped, or — since Tesseract's English
// model has no glyph for ₹ — misread as a stray leading digit that merges
// into the amount (₹4.00 becomes "24.00"). Prefer a currency-prefixed match,
// but also collect every bare "X.XX" number as a candidate, including a
// variant with its leading digit stripped, since that covers the misread
// case without weakening the check itself (we still require an exact match
// against the order's real amount, so this can't be used to fake a wrong
// payment).
const AMOUNT_CURRENCY_PATTERN = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i;
const AMOUNT_BARE_PATTERN = /\b(\d+)\.(\d{2})\b/g;
// Some apps show a whole-rupee amount with no decimals at all (Super Money
// renders "₹12"), which the decimal pattern above can't catch once OCR
// mangles the ₹ glyph. Those amounts sit alone on their own line, so match
// "a line containing only a number, optionally preceded by a couple of junk
// characters" — the junk being whatever ₹ was misread as. Requiring the
// number to be the entire line is what keeps this from matching digits
// inside a date or a transaction ID.
const AMOUNT_OWN_LINE_PATTERN = /^[^\dA-Za-z\n]{0,3}\s*(\d[\d,]*)(?:\.(\d{1,2}))?\s*$/gm;

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

// Every UPI app writes its timestamp differently, so both orderings are
// matched, with a permissive separator between the date and time parts:
//
//   GPay        "13 August 2026, 2:40pm"      date first, comma
//   BHIM        "13th Aug 26, 01:58 am"       ordinal day, 2-digit year
//   Super Money "12 August 2026 • 07:45PM"    bullet separator, no space before PM
//   PhonePe     "07:06 PM on 08 Aug 2026"     TIME first, joined by "on"
//
// The separator is "any run of up to 3 non-alphanumeric characters" rather
// than a fixed list, because OCR renders glyphs like • inconsistently
// (as *, °, ©, . or dropped entirely) and a fixed list silently fails to
// match whichever variant it didn't anticipate.
//
// Both patterns capture separate numeric groups rather than a date-like
// substring, since handing an assembled string to `new Date(...)` is what
// caused an earlier bug: JS's built-in parser returns Invalid Date for
// "12:08am" (no space before am/pm) with no error, and code that falls back
// to a looser pattern on that failure ends up reading "12:08" as 24-hour
// time instead of 12:08 AM — a silent ~12-hour misread.
const DATE_PART = String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s+(\d{2}(?:\d{2})?)`;
const TIME_PART = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap]\.?[Mm]\.?)?`;
const SEPARATOR = String.raw`\s*[^\dA-Za-z\n]{0,3}\s*`;

const DATETIME_DATE_FIRST = new RegExp(DATE_PART + SEPARATOR + TIME_PART);
const DATETIME_TIME_FIRST = new RegExp(TIME_PART + String.raw`\s+on\s+` + DATE_PART, "i");

// UPI screenshots show the customer's local wall-clock time. This app is
// for a single India shop, so that's always IST (UTC+5:30) — hardcoding it
// avoids depending on the server process's timezone, which differs between
// a local dev machine and a Vercel deployment and would otherwise make the
// same code parse timestamps differently in each place.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function parseReceiptDateTime(text: string): Date | null {
  // Group order differs between the two patterns (date-first vs time-first),
  // so normalize into the same set of parts before building the Date.
  let dayStr: string, monthStr: string, yearStr: string;
  let hourStr: string, minuteStr: string, secondStr: string | undefined, ampm: string | undefined;

  const dateFirst = text.match(DATETIME_DATE_FIRST);
  const timeFirst = text.match(DATETIME_TIME_FIRST);

  if (dateFirst) {
    [, dayStr, monthStr, yearStr, hourStr, minuteStr, secondStr, ampm] = dateFirst;
  } else if (timeFirst) {
    [, hourStr, minuteStr, secondStr, ampm, dayStr, monthStr, yearStr] = timeFirst;
  } else {
    return null;
  }

  const month = MONTH_INDEX[monthStr.toLowerCase()];
  if (month === undefined) return null;

  // A 2-digit year ("26") always means 20xx here — this app didn't exist
  // before 2020 and won't still be running unmodified past 2099.
  const year = yearStr.length === 2 ? 2000 + Number(yearStr) : Number(yearStr);

  let hour = Number(hourStr);
  if (ampm) {
    // Strip any dots OCR picked up from "P.M." before comparing.
    const isPM = ampm.toLowerCase().replace(/\./g, "") === "pm";
    if (hour === 12) hour = isPM ? 12 : 0;
    else if (isPM) hour += 12;
  }

  const utcMs =
    Date.UTC(year, month, Number(dayStr), hour, Number(minuteStr), secondStr ? Number(secondStr) : 0) -
    IST_OFFSET_MS;
  const parsed = new Date(utcMs);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function extractPaymentFields(text: string): ExtractedPaymentFields {
  const utrMatch = text.match(UTR_KEYWORD_PATTERN) ?? text.match(UTR_FALLBACK_PATTERN);

  const currencyMatch = text.match(AMOUNT_CURRENCY_PATTERN);
  const amountCandidates: number[] = [];
  if (currencyMatch) {
    amountCandidates.push(Number(currencyMatch[1].replace(/,/g, "")));
  }
  for (const match of text.matchAll(AMOUNT_BARE_PATTERN)) {
    const [, intPart, decimalPart] = match;
    amountCandidates.push(Number(`${intPart}.${decimalPart}`));
    if (intPart.length > 1) {
      amountCandidates.push(Number(`${intPart.slice(1)}.${decimalPart}`));
    }
  }
  for (const match of text.matchAll(AMOUNT_OWN_LINE_PATTERN)) {
    const [, intPart, decimalPart] = match;
    const whole = intPart.replace(/,/g, "");
    amountCandidates.push(Number(decimalPart ? `${whole}.${decimalPart}` : whole));
    // Same leading-digit-strip as above: a misread ₹ can merge into the
    // number ("₹4" -> "24") instead of landing in the junk-prefix class.
    if (whole.length > 1) {
      const stripped = whole.slice(1);
      amountCandidates.push(Number(decimalPart ? `${stripped}.${decimalPart}` : stripped));
    }
  }

  return {
    utr: utrMatch ? (utrMatch[1] ?? utrMatch[0]) : null,
    amount: amountCandidates.length > 0 ? amountCandidates[0] : null,
    amountCandidates,
    dateTime: parseReceiptDateTime(text),
    rawText: text,
  };
}

export function verifyPayment(params: {
  text: string;
  expectedAmount: number;
  expectedShopName: string;
  windowStart: Date;
  windowEnd: Date;
}): { ok: boolean; reason?: PaymentVerificationFailureReason; extracted: ExtractedPaymentFields } {
  const { text, expectedAmount, expectedShopName, windowStart, windowEnd } = params;

  if (!text.trim()) {
    return {
      ok: false,
      reason: "unreadable",
      extracted: { utr: null, amount: null, amountCandidates: [], dateTime: null, rawText: text },
    };
  }

  const extracted = extractPaymentFields(text);

  // The transaction ID is a bonus signal when present (some UPI apps'
  // default confirmation screenshot never shows one, e.g. GPay), not a
  // hard requirement — the caller fingerprints the payment (UTR if found,
  // otherwise a hash of the image) and checks it against past orders to
  // guard against the same screenshot being reused.
  const amountMatches = extracted.amountCandidates.some((c) => Math.abs(c - expectedAmount) <= 0.01);
  if (!amountMatches) {
    return { ok: false, reason: "amount_mismatch", extracted };
  }

  const normalizedText = text.toLowerCase().replace(/\s+/g, " ");
  const normalizedShopName = expectedShopName.trim().toLowerCase();
  if (!normalizedShopName || !normalizedText.includes(normalizedShopName)) {
    return { ok: false, reason: "shop_name_mismatch", extracted };
  }

  // UPI receipts show minute-level precision only ("1:42am", no seconds),
  // so a payment timestamp gets truncated to :00 — it can appear up to 59s
  // earlier than the real moment. A payment made seconds after the order
  // was created can therefore round down to just before windowStart. Give
  // both edges of the window a minute of slack to absorb that rounding.
  const TIMESTAMP_ROUNDING_SLACK_MS = 60 * 1000;
  const graceStart = new Date(windowStart.getTime() - TIMESTAMP_ROUNDING_SLACK_MS);
  const graceEnd = new Date(windowEnd.getTime() + TIMESTAMP_ROUNDING_SLACK_MS);
  if (!extracted.dateTime || extracted.dateTime < graceStart || extracted.dateTime > graceEnd) {
    return { ok: false, reason: "datetime_out_of_window", extracted };
  }

  return { ok: true, extracted };
}
