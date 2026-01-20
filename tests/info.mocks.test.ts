describe('getAllAirports with inconsistent mappings', () => {
  it('excludes airports missing timezone entries', async () => {
    jest.resetModules();
    jest.doMock('../src/mapping/timezones', () => ({
      timezones: { AAA: 'UTC' }
    }));
    jest.doMock('../src/mapping/geo', () => ({
      geo: {
        AAA: {
          latitude: 1,
          longitude: 2,
          name: 'Airport A',
          city: 'City A',
          country: 'AA',
          countryName: 'Aland',
          continent: 'Europe'
        },
        BBB: {
          latitude: 3,
          longitude: 4,
          name: 'Airport B',
          city: 'City B',
          country: 'BB',
          countryName: 'Bland',
          continent: 'Asia'
        }
      }
    }));

    const { getAllAirports } = await import('../src/info');
    const all = getAllAirports();

    expect(all).toHaveLength(1);
    expect(all[0].iata).toBe('AAA');
  });
});
