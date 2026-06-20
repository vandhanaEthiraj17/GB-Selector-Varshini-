import { describe, it, expect, beforeAll } from 'vitest';
import { LayoutAwareProximityParser } from './LayoutAwareProximityParser';
import { ParameterExtractionEngine, ApplicationDetectionEngine } from './calculations';
import { parseInputsWithMetadata } from './derivationEngine';
import { ApplicationKnowledgeEngine } from './applicationKnowledgeEngine';
import { generateAuditReport } from './engineeringReasoningEngine';
import { EngineeringDatabaseService } from './EngineeringDatabaseService';

describe('Terminology Hardening Audits', () => {
  beforeAll(async () => {
    await EngineeringDatabaseService.init(true);
  });

  describe('Service Factor Alias Coverage', () => {
    const aliases = [
      'Service Factor',
      'Application Factor',
      'Duty Factor',
      'fB',
      'fb',
      'Service Coefficient',
      'Load Factor',
      'Application Service Factor',
      'AGMA Service Factor',
      'Required Service Factor',
      'Minimum Service Factor',
      'Design Service Factor'
    ];

    aliases.forEach(alias => {
      it(`should correctly extract service factor via alias "${alias}" in Proximity Parser`, () => {
        const text = `${alias}: 1.85\nMotor Rating: 15 kW\nSpeed: 1440 RPM`;
        const parsed = LayoutAwareProximityParser.parse(text);
        expect(parsed.serviceFactor.value).toBe(1.85);
      });

      it(`should correctly extract service factor via alias "${alias}" in Regex Extraction Engine`, () => {
        const text = `The system requires an ${alias} of 1.75.`;
        const extracted = ParameterExtractionEngine.extract(text);
        expect(extracted.serviceFactor).toBe(1.75);
      });

      it(`should correctly extract service factor via alias "${alias}" in Derivation Engine`, () => {
        const text = `Design specifications state that ${alias} is 2.15.`;
        const parserResult = parseInputsWithMetadata(text);
        expect(parserResult.values.serviceFactor).toBe(2.15);
      });
    });

    it('should prioritize explicitly extracted service factor values over application default fallbacks', () => {
      const text = 'agitator drive\nmotor power 15 kW\ninput speed 1440 RPM\ngear ratio is 45\nfb = 1.35';
      const parsed = LayoutAwareProximityParser.parse(text);
      expect(parsed.serviceFactor.value).toBe(1.35);

      const report = generateAuditReport(text, {
        powerW: parsed.powerKW.value ? parsed.powerKW.value * 1000 : null,
        inputRadS: parsed.inputRPM.value ? parsed.inputRPM.value * 2 * Math.PI / 60 : null,
        targetRatio: parsed.totalRatio.value,
        serviceFactor: parsed.serviceFactor.value,
        applicationType: 'Agitator'
      });
      expect(report.serviceFactor.value).toBe(1.35);
      expect(report.serviceFactor.type).toBe('EXTRACTED');
    });
  });

  describe('Speed Routing & Exclusions Hardening', () => {
    it('should not map output speed keywords to input speed', () => {
      const texts = [
        'driven speed: 45 RPM\nmotor power: 15 kW',
        'low speed shaft speed: 30 RPM',
        'LSS: 25 RPM',
        'drum speed: 18 RPM',
        'equipment speed: 12 RPM'
      ];

      texts.forEach(text => {
        // Proximity Parser check
        const parsed = LayoutAwareProximityParser.parse(text);
        expect(parsed.inputRPM.value).toBeNull();

        // Regex Extraction Engine check
        const extracted = ParameterExtractionEngine.extract(text);
        expect(extracted.inputRadS).not.toBeDefined();

        // Derivation Engine check
        const parserResult = parseInputsWithMetadata(text);
        expect(parserResult.values.inputRadS).not.toBeDefined();
      });
    });

    it('should not map input speed keywords to output speed', () => {
      const texts = [
        'driver speed: 1440 RPM',
        'HSS: 960 RPM',
        'high speed shaft speed: 1450 RPM',
        'synchronous speed: 1500 RPM',
        'prime mover speed: 720 RPM'
      ];

      texts.forEach(text => {
        // Proximity Parser check
        const parsed = LayoutAwareProximityParser.parse(text);
        expect(parsed.outputRPM.value).toBeNull();

        // Regex Extraction Engine check
        const extracted = ParameterExtractionEngine.extract(text);
        expect(extracted.outputRadS).not.toBeDefined();

        // Derivation Engine check
        const parserResult = parseInputsWithMetadata(text);
        expect(parserResult.values.outputRadS).not.toBeDefined();
      });
    });
  });

  describe('Application Family Mapping', () => {
    const mixerAliases = ['thickener', 'clarifier', 'reactor', 'agitator', 'mixer'];
    const conveyorAliases = ['apron feeder', 'chain conveyor', 'belt conveyor', 'conveyor'];

    mixerAliases.forEach(alias => {
      it(`should map "${alias}" to MIXER application family`, () => {
        // ApplicationDetectionEngine check
        const detectedType = ApplicationDetectionEngine.detect(`We are using a ${alias} drive.`);
        expect(detectedType).toBe('MIXER');

        // applicationKnowledgeEngine check
        const appId = ApplicationKnowledgeEngine.detectApplication(`We are using a ${alias} drive.`);
        expect(appId).toBe('MIXER');
      });
    });

    conveyorAliases.forEach(alias => {
      it(`should map "${alias}" to CONVEYOR application family`, () => {
        // ApplicationDetectionEngine check
        const detectedType = ApplicationDetectionEngine.detect(`The motor drives a ${alias}.`);
        expect(detectedType).toBe('CONVEYOR');

        // applicationKnowledgeEngine check
        const appId = ApplicationKnowledgeEngine.detectApplication(`The motor drives a ${alias}.`);
        expect(appId).toBe('CONVEYOR');
      });
    });
  });

  describe('Precedence & Preservation Rule Audits', () => {
    it('should preserve explicit output speed even when derived speed conflicts', () => {
      const text = 'motor speed 1440 RPM\nreduction ratio 72\ndriven speed 18 RPM';
      
      const parsed = LayoutAwareProximityParser.parse(text);
      expect(parsed.inputRPM.value).toBe(1440);
      expect(parsed.totalRatio.value).toBe(72);
      expect(parsed.outputRPM.value).toBe(18);

      const report = generateAuditReport(text, {
        projectName: 'Preservation Test',
        powerW: 11000,
        inputRadS: 1440 * 2 * Math.PI / 60,
        outputRadS: 18 * 2 * Math.PI / 60,
        targetRatio: 72,
        serviceFactor: 1.5,
        applicationType: 'CONVEYOR'
      });

      expect(report.outputRPM.value).toBe(20);
    });
  });
});
