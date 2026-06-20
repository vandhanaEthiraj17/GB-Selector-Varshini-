import { describe, it, expect, beforeAll } from 'vitest';
import { EngineeringDatabaseService } from './EngineeringDatabaseService';

describe('EngineeringDatabaseService Integration Test Suite', () => {
  beforeAll(async () => {
    await EngineeringDatabaseService.init(true);
  });

  it('should initialize successfully in test environment', async () => {
    const gearboxes = EngineeringDatabaseService.getGearboxDatabase();
    const ratios = EngineeringDatabaseService.getSeriesData();

    expect(gearboxes).toBeDefined();
    expect(gearboxes.length).toBeGreaterThan(100); // Baseline is 156+

    expect(ratios).toBeDefined();
    expect(Object.keys(ratios)).toContain('s1');
    expect(Object.keys(ratios)).toContain('s2');
    expect(Object.keys(ratios)).toContain('s3');
    expect(Object.keys(ratios)).toContain('s4');
  });

  it('should enrich loaded gearboxes with thermal and thrust capacities', () => {
    const gearboxes = EngineeringDatabaseService.getGearboxDatabase();
    
    // Check first model has populated capacities
    const firstGb = gearboxes[0];
    expect(firstGb.thermal_capacity_kw).toBeDefined();
    expect(firstGb.thermal_capacity_kw).toBeGreaterThan(0);
    expect(firstGb.thrust_load_rating_kn).toBeDefined();
    expect(firstGb.thrust_load_rating_kn).toBeGreaterThan(0);
  });

  it('should hold the exact series ratio ranges parsed from Excel ratios', () => {
    const ratios = EngineeringDatabaseService.getSeriesData();
    
    // Verify s1 ratios (18 elements sorted)
    expect(ratios.s1.length).toBeGreaterThanOrEqual(18);
    expect(ratios.s1[0]).toBe(3.75);
    expect(ratios.s1[ratios.s1.length - 1]).toBe(10.26);

    // Verify boundaries are intact
    expect(ratios.s2[0]).toBe(4.71);
    expect(ratios.s3[0]).toBe(4.76);
    expect(ratios.s4[0]).toBe(4.00);
  });

  it('should correctly merge and backfill Series 2 and Series 3 gearboxes from default database', () => {
    const gearboxes = EngineeringDatabaseService.getGearboxDatabase();
    
    const s2Count = gearboxes.filter(g => g.series === 2).length;
    const s3Count = gearboxes.filter(g => g.series === 3).length;

    expect(s2Count).toBeGreaterThanOrEqual(30); // Hardcoded had 32
    expect(s3Count).toBeGreaterThanOrEqual(30); // Hardcoded had 35
  });
});
