export interface GeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

interface RawGeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '5');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Geocoding request failed: ${res.status}`);
  }

  const data = (await res.json()) as { results?: RawGeocodeResult[] };
  return (data.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country ?? '',
    admin1: r.admin1,
  }));
}

function normalizeLocationToken(value: string): string {
  return value.trim().toLowerCase();
}

function expandLocationAlias(token: string): string[] {
  const normalized = normalizeLocationToken(token);
  if (normalized === 'usa' || normalized === 'us' || normalized === 'u.s.' || normalized === 'u.s.a.') {
    return [normalized, 'united states'];
  }
  if (normalized === 'uk' || normalized === 'u.k.') {
    return [normalized, 'united kingdom'];
  }
  return [normalized];
}

function locationFieldMatchesToken(field: string, token: string): boolean {
  const normalizedField = normalizeLocationToken(field);
  for (const alias of expandLocationAlias(token)) {
    if (normalizedField === alias || normalizedField.includes(alias) || alias.includes(normalizedField)) {
      return true;
    }
  }
  return false;
}

/** Pick the best geocode match; comma-separated queries match on region/country. */
export function pickGeocodeResult(query: string, results: GeocodeResult[]): GeocodeResult | undefined {
  if (results.length === 0) return undefined;

  const trimmed = query.trim();
  if (!trimmed.includes(',')) return results[0];

  const qualifiers = trimmed
    .split(',')
    .slice(1)
    .map((part) => part.trim())
    .filter(Boolean);
  if (qualifiers.length === 0) return results[0];

  let best: GeocodeResult | undefined;
  let bestScore = 0;

  for (const result of results) {
    const fields = [result.admin1 ?? '', result.country ?? '', result.name];
    let score = 0;
    for (const qualifier of qualifiers) {
      if (fields.some((field) => locationFieldMatchesToken(field, qualifier))) {
        score++;
      }
    }
    if (score > bestScore) {
      best = result;
      bestScore = score;
    }
  }

  if (best && bestScore > 0) return best;
  return results[0];
}

export async function resolveLocationFromQuery(query: string): Promise<GeocodeResult | undefined> {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  const searchTerm = trimmed.includes(',') ? trimmed.split(',')[0]!.trim() : trimmed;
  if (!searchTerm) return undefined;

  const results = await geocodeSearch(searchTerm);
  return pickGeocodeResult(trimmed, results);
}

export function formatGeocodeName(result: GeocodeResult): string {
  return [result.name, result.admin1, result.country].filter(Boolean).join(', ');
}

export interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
}

export interface ForecastResult {
  currentTemperature: number;
  currentWeatherCode: number;
  daily: DailyForecast[];
}

interface RawForecastResponse {
  current: { temperature_2m: number; weather_code: number };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
  tempUnit: 'celsius' | 'fahrenheit'
): Promise<ForecastResult> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('temperature_unit', tempUnit);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast request failed: ${res.status}`);
  }

  const data = (await res.json()) as RawForecastResponse;
  return {
    currentTemperature: data.current.temperature_2m,
    currentWeatherCode: data.current.weather_code,
    daily: data.daily.time.map((date, i) => ({
      date,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      weatherCode: data.daily.weather_code[i],
    })),
  };
}
