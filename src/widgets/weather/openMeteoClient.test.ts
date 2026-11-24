import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchForecast,
  pickGeocodeResult,
  resolveLocationFromQuery,
  type GeocodeResult,
} from './openMeteoClient';

const portlandOr: GeocodeResult = {
  id: 1,
  name: 'Portland',
  latitude: 45.52,
  longitude: -122.68,
  admin1: 'Oregon',
  country: 'United States',
  countryCode: 'US',
};

const portlandMe: GeocodeResult = {
  id: 2,
  name: 'Portland',
  latitude: 43.66,
  longitude: -70.26,
  admin1: 'Maine',
  country: 'United States',
  countryCode: 'US',
};

const parisFr: GeocodeResult = {
  id: 3,
  name: 'Paris',
  latitude: 48.86,
  longitude: 2.35,
  admin1: 'Île-de-France',
  country: 'France',
  countryCode: 'FR',
};

const parisTx: GeocodeResult = {
  id: 4,
  name: 'Paris',
  latitude: 33.66,
  longitude: -95.56,
  admin1: 'Texas',
  country: 'United States',
  countryCode: 'US',
};

const parisAr: GeocodeResult = {
  id: 6,
  name: 'Paris',
  latitude: 35.29,
  longitude: -93.73,
  admin1: 'Arkansas',
  country: 'United States',
  countryCode: 'US',
};

const londonUk: GeocodeResult = {
  id: 7,
  name: 'London',
  latitude: 51.51,
  longitude: -0.13,
  admin1: 'England',
  country: 'United Kingdom',
  countryCode: 'GB',
};

const londonOn: GeocodeResult = {
  id: 8,
  name: 'London',
  latitude: 42.98,
  longitude: -81.25,
  admin1: 'Ontario',
  country: 'Canada',
  countryCode: 'CA',
};

describe('pickGeocodeResult', () => {
  it('uses the first result when there is no comma', () => {
    expect(pickGeocodeResult('Portland', [portlandMe, portlandOr])).toBe(portlandMe);
  });

  it('matches the region after a comma', () => {
    expect(pickGeocodeResult('Portland, Oregon', [portlandMe, portlandOr])).toBe(portlandOr);
    expect(pickGeocodeResult('Portland, Maine', [portlandOr, portlandMe])).toBe(portlandMe);
    expect(pickGeocodeResult('Paris, France', [parisTx, parisFr])).toBe(parisFr);
  });

  it('resolves 2-letter state/province qualifiers without false substring matches against city name', () => {
    expect(pickGeocodeResult('London, ON', [londonUk, londonOn])).toBe(londonOn);
    expect(pickGeocodeResult('Portland, OR', [portlandMe, portlandOr])).toBe(portlandOr);
    expect(pickGeocodeResult('Paris, AR', [parisFr, parisAr])).toBe(parisAr);
  });

  it('matches admin2 and countryCode qualifiers', () => {
    const springfieldCook: GeocodeResult = {
      id: 9,
      name: 'Springfield',
      latitude: 39.8,
      longitude: -89.64,
      admin1: 'Illinois',
      admin2: 'Sangamon County',
      country: 'United States',
      countryCode: 'US',
    };
    const springfieldOr: GeocodeResult = {
      id: 10,
      name: 'Springfield',
      latitude: 44.05,
      longitude: -123.02,
      admin1: 'Oregon',
      admin2: 'Lane County',
      country: 'United States',
      countryCode: 'US',
    };
    expect(pickGeocodeResult('Springfield, Lane County', [springfieldCook, springfieldOr])).toBe(
      springfieldOr
    );
    expect(pickGeocodeResult('London, GB', [londonOn, londonUk])).toBe(londonUk);
  });

  it('falls back to the first result when qualifiers do not match', () => {
    expect(pickGeocodeResult('Portland, Antarctica', [portlandMe, portlandOr])).toBe(portlandMe);
  });

  it('does not treat empty region or country as a match for any qualifier', () => {
    const unnamed: GeocodeResult = {
      id: 5,
      name: 'Portland',
      latitude: 0,
      longitude: 0,
      admin1: '',
      country: '',
    };
    expect(pickGeocodeResult('Portland, Oregon', [unnamed, portlandOr])).toBe(portlandOr);
  });
});

describe('openMeteoClient AbortSignal forwarding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards AbortSignal to fetch in resolveLocationFromQuery and fetchForecast', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ ...portlandOr, country_code: 'US' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: { temperature_2m: 60, weather_code: 0 },
          daily: { time: ['2026-06-01'], temperature_2m_max: [65], temperature_2m_min: [50], weather_code: [0] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    await resolveLocationFromQuery('Portland, OR', controller.signal);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('geocoding-api.open-meteo.com'),
      { signal: controller.signal }
    );

    await fetchForecast(45.52, -122.68, 'fahrenheit', controller.signal);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('api.open-meteo.com/v1/forecast'),
      { signal: controller.signal }
    );
  });
});
