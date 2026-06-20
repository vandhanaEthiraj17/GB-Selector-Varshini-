import { describe, it, expect } from 'vitest';
import { UnitConverter } from './UnitConverter';
import { LayoutAwareProximityParser } from './LayoutAwareProximityParser';

describe('UnitConverter', () => {
  it('should convert kW and HP to Watts', () => {
    const res1 = UnitConverter.convert(15, 'kW');
    expect(res1.normalizedValue).toBe(15000);
    expect(res1.normalizedUnit).toBe('W');

    const res2 = UnitConverter.convert(10, 'HP');
    expect(res2.normalizedValue).toBeCloseTo(7457);
    expect(res2.normalizedUnit).toBe('W');
  });

  it('should convert RPM to rad/s', () => {
    const res = UnitConverter.convert(1440, 'RPM');
    expect(res.normalizedValue).toBeCloseTo(1440 * 2 * Math.PI / 60);
    expect(res.normalizedUnit).toBe('rad/s');
  });

  it('should convert torque units to N.m', () => {
    const res1 = UnitConverter.convert(100, 'Nm');
    expect(res1.normalizedValue).toBe(100);

    const res2 = UnitConverter.convert(10, 'kgf.m');
    expect(res2.normalizedValue).toBeCloseTo(98.0665);
    expect(res2.normalizedUnit).toBe('N·m');
  });
});

describe('LayoutAwareProximityParser', () => {
  it('should parse flat text with label and values', () => {
    const text = 'Motor Rating: 15 kW\nSpeed: 1440 RPM\nRatio: 72\nApplication: belt conveyor';
    const parsed = LayoutAwareProximityParser.parse(text);

    expect(parsed.powerKW.value).toBe(15);
    expect(parsed.inputRPM.value).toBe(1440);
    expect(parsed.totalRatio.value).toBe(72);
    expect(parsed.applicationType.value).toBe('CONVEYOR');
  });

  it('should parse tabular grid layouts with columns', () => {
    const tableText = `
Parameter\tValue\tUnit
Motor Power\t90\tkw
Motor Speed\t1000\trpm
Gearbox Ratio\t160\t:1
    `;
    const parsed = LayoutAwareProximityParser.parse(tableText);

    expect(parsed.powerKW.value).toBe(90);
    expect(parsed.inputRPM.value).toBe(1000);
    expect(parsed.totalRatio.value).toBe(160);
  });

  it('should handle missing parameters correctly as null/missing lineage', () => {
    const text = 'Only project name: Conveyor Project';
    const parsed = LayoutAwareProximityParser.parse(text);

    expect(parsed.powerKW.value).toBeNull();
    expect(parsed.powerKW.confidence).toBe('Low');
    expect(parsed.powerKW.auditExplanation).toContain('MISSING');
  });
});
