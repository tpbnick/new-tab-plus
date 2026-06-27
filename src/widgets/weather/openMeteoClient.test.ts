import { describe, expect, it } from 'vitest';
import { pickGeocodeResult, type GeocodeResult } from './openMeteoClient';

const portlandOr: GeocodeResult = {
  id: 1,
  name: 'Portland',
  latitude: 45.52,
  longitude: -122.68,
  admin1: 'Oregon',
  country: 'United States',
};

const portlandMe: GeocodeResult = {
  id: 2,
  name: 'Portland',
  latitude: 43.66,
  longitude: -70.26,
  admin1: 'Maine',
  country: 'United States',
};

const parisFr: GeocodeResult = {
  id: 3,
  name: 'Paris',
  latitude: 48.86,
  longitude: 2.35,
  admin1: 'Île-de-France',
  country: 'France',
};

const parisTx: GeocodeResult = {
  id: 4,
  name: 'Paris',
  latitude: 33.66,
  longitude: -95.56,
  admin1: 'Texas',
  country: 'United States',
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

  it('falls back to the first result when qualifiers do not match', () => {
    expect(pickGeocodeResult('Portland, Antarctica', [portlandMe, portlandOr])).toBe(portlandMe);
  });
});
