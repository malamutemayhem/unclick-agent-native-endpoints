// OpenF1 Formula 1 API integration for the UnClick MCP server.
// Uses the OpenF1 public API via fetch - no external dependencies, no API key required.
// Documentation: https://openf1.org/

const OPENF1_BASE = "https://api.openf1.org/v1";

// ─── API helper ──────────────────────────────────────────────────────────────

async function openf1Fetch<T>(
  path: string,
  params: Record<string, string | number>
): Promise<T[]> {
  const url = new URL(`${OPENF1_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenF1 API HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T[]>;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function f1Sessions(
  args: Record<string, unknown>
): Promise<unknown> {
  const params: Record<string, string | number> = {};
  if (args.year) params.year = Number(args.year);
  if (args.country) params.country_name = String(args.country);
  if (args.session_name) params.session_name = String(args.session_name);

  const data = await openf1Fetch<Record<string, unknown>>("/sessions", params);

  return {
    count: data.length,
    sessions: data.map((s) => ({
      session_key: s.session_key,
      session_name: s.session_name,
      session_type: s.session_type,
      date_start: s.date_start,
      date_end: s.date_end,
      year: s.year,
      country_name: s.country_name,
      circuit_short_name: s.circuit_short_name,
      meeting_name: s.meeting_name,
    })),
  };
}

export async function f1Drivers(
  args: Record<string, unknown>
): Promise<unknown> {
  const params: Record<string, string | number> = {};
  if (args.session_key) params.session_key = Number(args.session_key);

  const data = await openf1Fetch<Record<string, unknown>>("/drivers", params);

  return {
    count: data.length,
    drivers: data.map((d) => ({
      driver_number: d.driver_number,
      full_name: d.full_name,
      name_acronym: d.name_acronym,
      team_name: d.team_name,
      team_colour: d.team_colour ?? null,
      country_code: d.country_code ?? null,
      headshot_url: d.headshot_url ?? null,
    })),
  };
}

export async function f1Positions(
  args: Record<string, unknown>
): Promise<unknown> {
  const sessionKey = args.session_key;
  if (!sessionKey) throw new Error("session_key is required.");

  const params: Record<string, string | number> = {
    session_key: Number(sessionKey),
  };
  if (args.driver_number) params.driver_number = Number(args.driver_number);

  const data = await openf1Fetch<Record<string, unknown>>("/position", params);

  return {
    count: data.length,
    positions: data.slice(-50).map((p) => ({
      driver_number: p.driver_number,
      position: p.position,
      date: p.date,
    })),
  };
}

export async function f1Laps(
  args: Record<string, unknown>
): Promise<unknown> {
  const sessionKey = args.session_key;
  if (!sessionKey) throw new Error("session_key is required.");

  const params: Record<string, string | number> = {
    session_key: Number(sessionKey),
  };
  if (args.driver_number) params.driver_number = Number(args.driver_number);
  if (args.lap_number) params.lap_number = Number(args.lap_number);

  const data = await openf1Fetch<Record<string, unknown>>("/laps", params);

  return {
    count: data.length,
    laps: data.map((l) => ({
      driver_number: l.driver_number,
      lap_number: l.lap_number,
      lap_duration: l.lap_duration ?? null,
      is_pit_out_lap: l.is_pit_out_lap ?? false,
      duration_sector_1: l.duration_sector_1 ?? null,
      duration_sector_2: l.duration_sector_2 ?? null,
      duration_sector_3: l.duration_sector_3 ?? null,
    })),
  };
}

export async function f1PitStops(
  args: Record<string, unknown>
): Promise<unknown> {
  const sessionKey = args.session_key;
  if (!sessionKey) throw new Error("session_key is required.");

  const params: Record<string, string | number> = {
    session_key: Number(sessionKey),
  };
  if (args.driver_number) params.driver_number = Number(args.driver_number);

  const data = await openf1Fetch<Record<string, unknown>>("/pit", params);

  return {
    count: data.length,
    pit_stops: data.map((p) => ({
      driver_number: p.driver_number,
      lap_number: p.lap_number,
      pit_duration: p.pit_duration ?? null,
      date: p.date,
    })),
  };
}

export async function f1CarData(
  args: Record<string, unknown>
): Promise<unknown> {
  const sessionKey = args.session_key;
  if (!sessionKey) throw new Error("session_key is required.");

  const params: Record<string, string | number> = {
    session_key: Number(sessionKey),
  };
  if (args.driver_number) params.driver_number = Number(args.driver_number);

  const data = await openf1Fetch<Record<string, unknown>>("/car_data", params);
  // Car data can be very large - return last 100 entries
  const recent = data.slice(-100);

  return {
    count: recent.length,
    note: "Returns last 100 telemetry entries. Use a specific driver_number to narrow results.",
    telemetry: recent.map((c) => ({
      driver_number: c.driver_number,
      date: c.date,
      speed: c.speed ?? null,
      throttle: c.throttle ?? null,
      brake: c.brake ?? null,
      drs: c.drs ?? null,
      gear: c.n_gear ?? null,
      rpm: c.rpm ?? null,
    })),
  };
}

export async function f1TeamRadio(
  args: Record<string, unknown>
): Promise<unknown> {
  const sessionKey = args.session_key;
  if (!sessionKey) throw new Error("session_key is required.");

  const params: Record<string, string | number> = {
    session_key: Number(sessionKey),
  };
  if (args.driver_number) params.driver_number = Number(args.driver_number);

  const data = await openf1Fetch<Record<string, unknown>>(
    "/team_radio",
    params
  );

  return {
    count: data.length,
    messages: data.map((r) => ({
      driver_number: r.driver_number,
      date: r.date,
      recording_url: r.recording_url ?? null,
    })),
  };
}

export async function f1Weather(
  args: Record<string, unknown>
): Promise<unknown> {
  const sessionKey = args.session_key;
  if (!sessionKey) throw new Error("session_key is required.");

  const data = await openf1Fetch<Record<string, unknown>>("/weather", {
    session_key: Number(sessionKey),
  });

  return {
    count: data.length,
    weather: data.map((w) => ({
      date: w.date,
      air_temperature: w.air_temperature ?? null,
      track_temperature: w.track_temperature ?? null,
      humidity: w.humidity ?? null,
      rainfall: w.rainfall ?? null,
      wind_speed: w.wind_speed ?? null,
      wind_direction: w.wind_direction ?? null,
    })),
  };
}
