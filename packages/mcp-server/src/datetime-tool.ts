// Date and time utilities.
// No API required -- uses built-in JS Date and Intl APIs.

// ─── get_current_time ─────────────────────────────────────────────────────────

export function getCurrentTime(args: Record<string, unknown>): unknown {
  const tz = String(args.timezone ?? "UTC").trim();

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-AU", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "long",
    });

    const parts = Object.fromEntries(
      formatter.formatToParts(now).map((p) => [p.type, p.value])
    );

    return {
      timezone: tz,
      iso: now.toISOString(),
      local_datetime: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`,
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}:${parts.second}`,
      timezone_name: parts.timeZoneName ?? tz,
      unix_timestamp: Math.floor(now.getTime() / 1000),
    };
  } catch {
    return { error: `Invalid timezone "${tz}". Use IANA format, e.g. "Australia/Melbourne", "America/New_York", "UTC".` };
  }
}

// ─── convert_timezone ─────────────────────────────────────────────────────────

export function convertTimezone(args: Record<string, unknown>): unknown {
  const datetimeStr = String(args.datetime ?? "").trim();
  const fromTz = String(args.from_tz ?? "").trim();
  const toTz = String(args.to_tz ?? "").trim();

  if (!datetimeStr) return { error: "datetime is required (e.g. 2024-06-15T14:30:00)." };
  if (!fromTz) return { error: "from_tz is required (IANA timezone, e.g. America/New_York)." };
  if (!toTz) return { error: "to_tz is required (IANA timezone, e.g. Australia/Sydney)." };

  try {
    // Parse the datetime in the from_tz context
    const date = parseLocalDate(datetimeStr, fromTz);
    if (!date) return { error: `Could not parse datetime "${datetimeStr}". Use ISO format: YYYY-MM-DDTHH:MM:SS.` };

    const formatIn = (tz: string) => {
      try {
        const f = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false,
        });
        const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
        return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
      } catch {
        return null;
      }
    };

    const resultLocal = formatIn(toTz);
    if (!resultLocal) return { error: `Invalid timezone "${toTz}".` };

    return {
      input: datetimeStr,
      from_tz: fromTz,
      to_tz: toTz,
      result: resultLocal,
      iso_utc: date.toISOString(),
      unix_timestamp: Math.floor(date.getTime() / 1000),
    };
  } catch (e) {
    return { error: `Conversion failed: ${String(e)}` };
  }
}

// ─── calculate_date_diff ──────────────────────────────────────────────────────

export function calculateDateDiff(args: Record<string, unknown>): unknown {
  const d1 = parseDate(String(args.date1 ?? ""));
  const d2 = parseDate(String(args.date2 ?? ""));

  if (!d1) return { error: `Invalid date1 "${args.date1}". Use YYYY-MM-DD.` };
  if (!d2) return { error: `Invalid date2 "${args.date2}". Use YYYY-MM-DD.` };

  const msPerDay = 86400000;
  const diffMs = d2.getTime() - d1.getTime();
  const totalDays = Math.round(diffMs / msPerDay);
  const absDays = Math.abs(totalDays);

  const weeks = Math.floor(absDays / 7);
  const remainingDays = absDays % 7;

  // Approximate months and years
  const months = monthsBetween(d1, d2);
  const years = Math.floor(Math.abs(months) / 12);
  const remMonths = Math.abs(months) % 12;

  return {
    date1: args.date1,
    date2: args.date2,
    total_days: totalDays,
    absolute_days: absDays,
    weeks: weeks,
    weeks_and_days: `${weeks} weeks, ${remainingDays} days`,
    approximate_months: Math.abs(months),
    approximate_years_and_months: `${years} years, ${remMonths} months`,
    direction: totalDays >= 0 ? "date2 is after date1" : "date2 is before date1",
  };
}

// ─── add_to_date ──────────────────────────────────────────────────────────────

export function addToDate(args: Record<string, unknown>): unknown {
  const date = parseDate(String(args.date ?? ""));
  const amount = Math.round(Number(args.amount ?? 0));
  const unit = String(args.unit ?? "days").toLowerCase();

  if (!date) return { error: `Invalid date "${args.date}". Use YYYY-MM-DD.` };
  if (isNaN(amount)) return { error: "amount must be a number." };
  if (!["days", "weeks", "months", "years"].includes(unit)) {
    return { error: `unit must be one of: days, weeks, months, years.` };
  }

  const result = new Date(date);
  switch (unit) {
    case "days": result.setUTCDate(result.getUTCDate() + amount); break;
    case "weeks": result.setUTCDate(result.getUTCDate() + amount * 7); break;
    case "months": result.setUTCMonth(result.getUTCMonth() + amount); break;
    case "years": result.setUTCFullYear(result.getUTCFullYear() + amount); break;
  }

  return {
    input_date: args.date,
    amount,
    unit,
    result_date: formatIsoDate(result),
    day_of_week: result.toLocaleDateString("en-AU", { weekday: "long", timeZone: "UTC" }),
  };
}

// ─── get_business_days ────────────────────────────────────────────────────────

export function getBusinessDays(args: Record<string, unknown>): unknown {
  const start = parseDate(String(args.start_date ?? ""));
  const end = parseDate(String(args.end_date ?? ""));

  if (!start) return { error: `Invalid start_date "${args.start_date}". Use YYYY-MM-DD.` };
  if (!end) return { error: `Invalid end_date "${args.end_date}". Use YYYY-MM-DD.` };

  const msPerDay = 86400000;
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;

  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const totalDays = Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;

  return {
    start_date: args.start_date,
    end_date: args.end_date,
    business_days: count,
    total_calendar_days: totalDays,
    weekend_days: totalDays - count,
    note: "Excludes Saturdays and Sundays. Does not account for public holidays.",
  };
}

// ─── format_date ──────────────────────────────────────────────────────────────

export function formatDate(args: Record<string, unknown>): unknown {
  const date = parseDate(String(args.date ?? ""));
  const format = String(args.format ?? "iso").toLowerCase();

  if (!date) return { error: `Invalid date "${args.date}". Use YYYY-MM-DD.` };

  const formats: Record<string, string> = {
    iso: formatIsoDate(date),
    us: date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" }),
    au: date.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }),
    long: date.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
    short: date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
  };

  if (!formats[format]) {
    return { error: `format must be one of: iso, us, au, long, short.` };
  }

  return {
    input: args.date,
    format,
    result: formats[format],
    all_formats: formats,
  };
}

// ─── get_week_number ──────────────────────────────────────────────────────────

export function getWeekNumber(args: Record<string, unknown>): unknown {
  const date = parseDate(String(args.date ?? ""));
  if (!date) return { error: `Invalid date "${args.date}". Use YYYY-MM-DD.` };

  // ISO week number: week 1 contains the first Thursday of the year
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return {
    date: args.date,
    iso_week: weekNo,
    iso_year: target.getUTCFullYear(),
    formatted: `W${String(weekNo).padStart(2, "0")} ${target.getUTCFullYear()}`,
    day_of_week: date.toLocaleDateString("en-AU", { weekday: "long", timeZone: "UTC" }),
    day_number_in_year: getDayOfYear(date),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(d.getTime())) return null;
  return d;
}

function parseLocalDate(s: string, tz: string): Date | null {
  // Try to parse as UTC first, then adjust to timezone
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const year = +m[1], month = +m[2] - 1, day = +m[3];
  const hour = m[4] ? +m[4] : 0;
  const min = m[5] ? +m[5] : 0;
  const sec = m[6] ? +m[6] : 0;

  // Create date string and parse with timezone context using Intl
  const testDate = new Date(Date.UTC(year, month, day, hour, min, sec));
  if (isNaN(testDate.getTime())) return null;

  // Compute the UTC offset at that moment in the given timezone
  const utcStr = testDate.toLocaleString("en-CA", { timeZone: tz, hour12: false });
  const utcParts = utcStr.match(/(\d{4})-(\d{2})-(\d{2}),?\s*(\d{2}):(\d{2}):(\d{2})/);
  if (!utcParts) return testDate;

  const localAsUtc = Date.UTC(+utcParts[1], +utcParts[2] - 1, +utcParts[3], +utcParts[4], +utcParts[5], +utcParts[6]);
  const offset = localAsUtc - testDate.getTime();
  return new Date(testDate.getTime() - offset);
}

function formatIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function monthsBetween(a: Date, b: Date): number {
  const sign = b >= a ? 1 : -1;
  const from = a <= b ? a : b;
  const to = a <= b ? b : a;
  return sign * ((to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()));
}

function getDayOfYear(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}
