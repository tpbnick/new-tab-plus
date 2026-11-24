export interface GeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode?: string;
  admin1?: string;
  admin2?: string;
}

interface RawGeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
}

export async function geocodeSearch(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '5');

  const res = await fetch(url.toString(), signal ? { signal } : undefined);
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
    countryCode: r.country_code,
    admin1: r.admin1,
    admin2: r.admin2,
  }));
}

function normalizeLocationToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const REGION_ALIASES: Record<string, string[]> = {
  // Country abbreviations
  us: ['united states'],
  usa: ['united states', 'us'],
  'u.s.': ['united states', 'us'],
  'u.s.a.': ['united states', 'us'],
  uk: ['united kingdom', 'gb'],
  'u.k.': ['united kingdom', 'gb'],
  gb: ['united kingdom', 'uk'],
  au: ['australia'],
  br: ['brazil'],
  ch: ['switzerland'],
  cn: ['china'],
  es: ['spain'],
  fr: ['france'],
  ie: ['ireland'],
  it: ['italy'],
  jp: ['japan'],
  kr: ['south korea'],
  mx: ['mexico'],
  nz: ['new zealand'],
  se: ['sweden'],
  // US states & DC (including overlaps with country codes)
  al: ['alabama', 'albania'],
  ak: ['alaska'],
  az: ['arizona', 'azerbaijan'],
  ar: ['arkansas', 'argentina'],
  ca: ['california', 'canada'],
  co: ['colorado', 'colombia'],
  ct: ['connecticut'],
  dc: ['district of columbia'],
  de: ['delaware', 'germany'],
  fl: ['florida'],
  ga: ['georgia'],
  hi: ['hawaii'],
  id: ['idaho', 'indonesia'],
  il: ['illinois', 'israel'],
  in: ['indiana', 'india'],
  ia: ['iowa'],
  ks: ['kansas'],
  ky: ['kentucky'],
  la: ['louisiana', 'laos'],
  me: ['maine', 'montenegro'],
  md: ['maryland', 'moldova'],
  ma: ['massachusetts', 'morocco'],
  mi: ['michigan'],
  mn: ['minnesota', 'mongolia'],
  ms: ['mississippi'],
  mo: ['missouri'],
  mt: ['montana', 'malta'],
  ne: ['nebraska', 'niger'],
  nv: ['nevada'],
  nh: ['new hampshire'],
  nj: ['new jersey'],
  nm: ['new mexico'],
  ny: ['new york'],
  nc: ['north carolina'],
  nd: ['north dakota'],
  oh: ['ohio'],
  ok: ['oklahoma'],
  or: ['oregon'],
  pa: ['pennsylvania', 'panama'],
  ri: ['rhode island'],
  sc: ['south carolina'],
  sd: ['south dakota'],
  tn: ['tennessee', 'tunisia'],
  tx: ['texas'],
  ut: ['utah'],
  vt: ['vermont'],
  va: ['virginia'],
  wa: ['washington'],
  wv: ['west virginia'],
  wi: ['wisconsin'],
  wy: ['wyoming'],
  // Canadian provinces & territories
  ab: ['alberta'],
  bc: ['british columbia'],
  mb: ['manitoba'],
  nb: ['new brunswick'],
  nl: ['newfoundland and labrador', 'netherlands'],
  ns: ['nova scotia'],
  nt: ['northwest territories'],
  nu: ['nunavut'],
  on: ['ontario'],
  pe: ['prince edward island', 'peru'],
  qc: ['quebec'],
  sk: ['saskatchewan', 'slovakia'],
  yt: ['yukon'],
};

function expandLocationAlias(token: string): string[] {
  const normalized = normalizeLocationToken(token);
  const extra = REGION_ALIASES[normalized];
  return extra ? [normalized, ...extra] : [normalized];
}

function locationFieldMatchesToken(field: string, token: string): boolean {
  const normalizedField = normalizeLocationToken(field);
  if (!normalizedField) return false;

  for (const alias of expandLocationAlias(token)) {
    if (!alias) continue;
    if (normalizedField === alias) return true;
    if (alias.length <= 2 || normalizedField.length <= 2) continue;
    if (normalizedField.includes(alias) || alias.includes(normalizedField)) {
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
    const fields = [result.admin1 ?? '', result.admin2 ?? '', result.country ?? '', result.countryCode ?? ''];
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

export async function resolveLocationFromQuery(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult | undefined> {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  const searchTerm = trimmed.includes(',') ? trimmed.split(',')[0]!.trim() : trimmed;
  if (!searchTerm) return undefined;

  const results = await geocodeSearch(searchTerm, signal);
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
  tempUnit: 'celsius' | 'fahrenheit',
  signal?: AbortSignal
): Promise<ForecastResult> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('temperature_unit', tempUnit);

  const res = await fetch(url.toString(), signal ? { signal } : undefined);
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
