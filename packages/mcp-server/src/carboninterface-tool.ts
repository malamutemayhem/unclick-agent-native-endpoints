// ─── Carbon Interface Emissions Calculator ────────────────────────────────────
// Carbon Interface API for carbon footprint estimates.
// Auth: CARBONINTERFACE_API_KEY env or api_key arg (Bearer token).
// Docs: https://docs.carboninterface.com/

const CI_BASE = "https://www.carboninterface.com/api/v1";

// ─── API helper ──────────────────────────────────────────────────────────────

function getKey(args: Record<string, unknown>): string {
  const key = String(args.api_key ?? process.env.CARBONINTERFACE_API_KEY ?? "").trim();
  if (!key) throw new Error("api_key is required (or set CARBONINTERFACE_API_KEY env).");
  return key;
}

async function ciFetch<T>(
  path: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<T> {
  const res = await fetch(`${CI_BASE}${path}`, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = err.message ?? err.error ?? `HTTP ${res.status}`;
    throw new Error(`Carbon Interface API error: ${String(msg)}`);
  }
  return res.json() as Promise<T>;
}

interface EstimateResponse {
  data: {
    id:         string;
    type:       string;
    attributes: Record<string, unknown>;
  };
}

// ─── Operations ──────────────────────────────────────────────────────────────

export async function estimateFlightEmissions(
  args: Record<string, unknown>
): Promise<unknown> {
  const apiKey = getKey(args);

  // legs: array of { departure_airport, destination_airport, cabin_class? }
  const legs = args.legs;
  const passengers = Number(args.passengers ?? 1);

  if (!Array.isArray(legs) || legs.length === 0) {
    throw new Error(
      "legs is required - array of { departure_airport, destination_airport } " +
      "(IATA codes, e.g. [{departure_airport:'SFO', destination_airport:'LAX'}])."
    );
  }

  const mappedLegs = (legs as Record<string, unknown>[]).map((leg) => {
    const departure    = String(leg.departure_airport    ?? leg.from ?? "").toUpperCase();
    const destination  = String(leg.destination_airport  ?? leg.to   ?? "").toUpperCase();
    const cabin_class  = String(leg.cabin_class ?? "economy").toLowerCase();
    if (!departure || !destination) {
      throw new Error("Each leg requires departure_airport and destination_airport.");
    }
    return { departure_airport: departure, destination_airport: destination, cabin_class };
  });

  const data = await ciFetch<EstimateResponse>(
    "/estimates",
    { type: "flight", passengers, legs: mappedLegs },
    apiKey
  );

  const attrs = data.data.attributes;
  return {
    id:               data.data.id,
    type:             "flight",
    passengers,
    legs:             mappedLegs,
    carbon_g:         attrs.carbon_g,
    carbon_lb:        attrs.carbon_lb,
    carbon_kg:        attrs.carbon_kg,
    carbon_mt:        attrs.carbon_mt,
    distance_value:   attrs.distance_value ?? null,
    distance_unit:    attrs.distance_unit  ?? null,
    estimated_at:     attrs.estimated_at   ?? null,
  };
}

export async function estimateVehicleEmissions(
  args: Record<string, unknown>
): Promise<unknown> {
  const apiKey = getKey(args);

  const distanceValue = Number(args.distance_value ?? args.distance ?? 0);
  const distanceUnit  = String(args.distance_unit ?? "km").toLowerCase();
  const vehicleModelId = String(args.vehicle_model_id ?? "").trim();

  if (!distanceValue) throw new Error("distance_value is required.");
  if (!vehicleModelId) {
    throw new Error(
      "vehicle_model_id is required. " +
      "Use the Carbon Interface API to look up vehicle models by make/model/year."
    );
  }

  const data = await ciFetch<EstimateResponse>(
    "/estimates",
    {
      type:             "vehicle",
      distance_unit:    distanceUnit,
      distance_value:   distanceValue,
      vehicle_model_id: vehicleModelId,
    },
    apiKey
  );

  const attrs = data.data.attributes;
  return {
    id:              data.data.id,
    type:            "vehicle",
    vehicle_model_id: vehicleModelId,
    distance_value:  attrs.distance_value ?? distanceValue,
    distance_unit:   attrs.distance_unit  ?? distanceUnit,
    carbon_g:        attrs.carbon_g,
    carbon_lb:       attrs.carbon_lb,
    carbon_kg:       attrs.carbon_kg,
    carbon_mt:       attrs.carbon_mt,
    estimated_at:    attrs.estimated_at ?? null,
  };
}

export async function estimateElectricityEmissions(
  args: Record<string, unknown>
): Promise<unknown> {
  const apiKey = getKey(args);

  const electricityValue = Number(args.electricity_value ?? args.kwh ?? 0);
  const electricityUnit  = String(args.electricity_unit ?? "kwh").toLowerCase();
  const country          = String(args.country ?? "").trim().toLowerCase();
  const state            = String(args.state   ?? "").trim().toLowerCase();

  if (!electricityValue) throw new Error("electricity_value (kWh) is required.");
  if (!country)          throw new Error("country is required (ISO 3166-1 alpha-2, e.g. 'us', 'gb').");

  const body: Record<string, unknown> = {
    type:              "electricity",
    electricity_unit:  electricityUnit,
    electricity_value: electricityValue,
    country,
  };
  if (state) body.state = state;

  const data = await ciFetch<EstimateResponse>("/estimates", body, apiKey);

  const attrs = data.data.attributes;
  return {
    id:                data.data.id,
    type:              "electricity",
    country,
    state:             state || null,
    electricity_value: attrs.electricity_value ?? electricityValue,
    electricity_unit:  attrs.electricity_unit  ?? electricityUnit,
    carbon_g:          attrs.carbon_g,
    carbon_lb:         attrs.carbon_lb,
    carbon_kg:         attrs.carbon_kg,
    carbon_mt:         attrs.carbon_mt,
    estimated_at:      attrs.estimated_at ?? null,
  };
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

export async function carbonInterfaceAction(
  action: string,
  args:   Record<string, unknown>
): Promise<unknown> {
  switch (action) {
    case "estimate_flight_emissions":      return estimateFlightEmissions(args);
    case "estimate_vehicle_emissions":     return estimateVehicleEmissions(args);
    case "estimate_electricity_emissions": return estimateElectricityEmissions(args);
    default:
      return {
        error:
          `Unknown Carbon Interface action: "${action}". ` +
          "Valid: estimate_flight_emissions, estimate_vehicle_emissions, estimate_electricity_emissions.",
      };
  }
}
