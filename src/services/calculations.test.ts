import { describe, it, expect } from 'vitest';
import {
  StageDistributionEngine,
  TorquePropagationEngine,
  PowerTorqueEngine,
  MissingDataResolutionEngine,
  GearboxCalculationPipeline,
  ApplicationType
} from './calculations';

describe('Planetary Stage Ratio Distribution (StageDistributionEngine)', () => {
  it('should verify Example 7.2: Target Ratio 20.5 (2 Stages)', () => {
    const result = StageDistributionEngine.distributeRatio(20.5, 2);
    expect(result[0]).toBeGreaterThanOrEqual(3.75);
    expect(result[0]).toBeLessThanOrEqual(10.26);
    expect(result[1]).toBeGreaterThanOrEqual(4.71);
    expect(result[1]).toBeLessThanOrEqual(7.58);
    const product = result.reduce((a, b) => a * b, 1);
    expect(product).toBeCloseTo(20.5, 1);
  });

  it('should verify Example 7.3: Target Ratio 88.5 (3 Stages)', () => {
    const result = StageDistributionEngine.distributeRatio(88.5, 3);
    expect(result[0]).toBeCloseTo(3.95, 2);
    expect(result[1]).toBeCloseTo(4.71, 2);
    expect(result[2]).toBeCloseTo(4.76, 2);
    const product = result.reduce((a, b) => a * b, 1);
    expect(product).toBeCloseTo(88.5, 1);
  });

  it('should verify Example 7.4: Target Ratio 500 (4 Stages)', () => {
    const result = StageDistributionEngine.distributeRatio(500, 4);
    expect(result[0]).toBeCloseTo(4.81, 1);
    expect(result[1]).toBeCloseTo(4.81, 1);
    expect(result[2]).toBeCloseTo(4.81, 1);
    expect(result[3]).toBeCloseTo(4.50, 2);
    const product = result.reduce((a, b) => a * b, 1);
    expect(product).toBeCloseTo(500, 0);
  });

  it('should verify Example 7.5: Target Ratio 1500 (4 Stages)', () => {
    const result = StageDistributionEngine.distributeRatio(1500, 4);
    expect(result[0]).toBeCloseTo(8.69, 2);
    expect(result[1]).toBeCloseTo(7.58, 2);
    expect(result[2]).toBeCloseTo(5.06, 2);
    expect(result[3]).toBeCloseTo(4.50, 2);
    const product = result.reduce((a, b) => a * b, 1);
    expect(product).toBeCloseTo(1500, 0);
  });
});

describe('Torque and Speed Propagation (TorquePropagationEngine)', () => {
  it('should verify Section 8.2 Three-Stage Propagation Example (R=88.5)', () => {
    const stageRatios = [3.95, 4.71, 4.76];
    const inputPowerW = 15000;
    const inputRadS = 1440 * 2 * Math.PI / 60;
    
    // T0 = P / ω
    const T0 = PowerTorqueEngine.calcTorque(inputPowerW, inputRadS);
    expect(T0).toBeCloseTo(99.47, 1);
    
    const torques = TorquePropagationEngine.propagateTorques(T0, stageRatios, 0.97);
    const speeds = TorquePropagationEngine.propagateSpeeds(inputRadS, stageRatios);
    
    // Stage 1 output (Calculated high-precision output)
    expect(torques[1]).toBeCloseTo(381.13, 1);
    expect(speeds[1] * 60 / (2 * Math.PI)).toBeCloseTo(364.56, 1);
    
    // Stage 2 output
    expect(torques[2]).toBeCloseTo(1741.22, 1);
    expect(speeds[2] * 60 / (2 * Math.PI)).toBeCloseTo(77.40, 1);
    
    // Stage 3 output
    expect(torques[3]).toBeCloseTo(8039.29, 0);
    expect(speeds[3] * 60 / (2 * Math.PI)).toBeCloseTo(16.26, 1);
  });
});

describe('Section 11 Missing Data Resolution Engine', () => {
  it('should resolve power from input torque and speed', () => {
    const input = {
      applicationType: ApplicationType.CONVEYOR,
      loadType: 'uniform' as const,
      dutyHoursPerDay: 8,
      startsPerHour: 1,
      inputTorqueNm: 99.47,
      inputRadS: 1440 * 2 * Math.PI / 60
    };
    const resolvedPower = MissingDataResolutionEngine.resolvePower(input);
    expect(resolvedPower).toBeCloseTo(15000, 0);
  });

  it('should resolve torque from power and speed', () => {
    const input = {
      applicationType: ApplicationType.CONVEYOR,
      loadType: 'uniform' as const,
      dutyHoursPerDay: 8,
      startsPerHour: 1,
      powerW: 15000,
      inputRadS: 1440 * 2 * Math.PI / 60
    };
    const resolvedTorque = MissingDataResolutionEngine.resolveTorque(input);
    expect(resolvedTorque).toBeCloseTo(99.47, 1);
  });

  it('should resolve screw jack lifting torque', () => {
    const input = {
      applicationType: ApplicationType.SCREW_JACK,
      loadType: 'uniform' as const,
      dutyHoursPerDay: 8,
      startsPerHour: 1,
      axialLoadN: 35500,
      screwPitchM: 0.006
    };
    const resolvedTorque = MissingDataResolutionEngine.resolveTorque(input);
    expect(resolvedTorque).toBeCloseTo(84.76, 1);
  });

  it('should resolve total ratio from speeds', () => {
    const input = {
      applicationType: ApplicationType.CONVEYOR,
      loadType: 'uniform' as const,
      dutyHoursPerDay: 8,
      startsPerHour: 1,
      inputRadS: 1440 * 2 * Math.PI / 60,
      outputRadS: 20 * 2 * Math.PI / 60
    };
    const resolvedRatio = MissingDataResolutionEngine.resolveRatio(input);
    expect(resolvedRatio).toBeCloseTo(72, 1);
  });

  it('should resolve output RPM from input speed and ratio', () => {
    const input = {
      applicationType: ApplicationType.CONVEYOR,
      loadType: 'uniform' as const,
      dutyHoursPerDay: 8,
      startsPerHour: 1,
      inputRadS: 1440 * 2 * Math.PI / 60,
      totalRatio: 72
    };
    const resolvedRadS = MissingDataResolutionEngine.resolveOutputRadS(input);
    expect(resolvedRadS! * 60 / (2 * Math.PI)).toBeCloseTo(20, 1);
  });

  it('should resolve output RPM from screw linear velocity and pitch', () => {
    const input = {
      applicationType: ApplicationType.SCREW_JACK,
      loadType: 'uniform' as const,
      dutyHoursPerDay: 8,
      startsPerHour: 1,
      linearVelocityMS: 0.005, // 300 mm/min = 0.005 m/s
      screwPitchM: 0.006
    };
    const resolvedRadS = MissingDataResolutionEngine.resolveOutputRadS(input);
    expect(resolvedRadS! * 60 / (2 * Math.PI)).toBeCloseTo(50, 1);
  });
});

describe('Handbook Complete Worked Examples 13.1 - 13.4', () => {
  it('should verify Example 13.1: Belt Conveyor', () => {
    const input = {
      applicationType: ApplicationType.CONVEYOR,
      loadType: 'uniform' as const,
      dutyHoursPerDay: 12,
      startsPerHour: 4,
      powerW: 15000,
      inputRadS: 1440 * 2 * Math.PI / 60,
      outputRadS: 20 * 2 * Math.PI / 60,
      serviceFactor: 1.5
    };
    
    const result = GearboxCalculationPipeline.execute(input);
    
    expect(result.total_ratio).toBeCloseTo(72.0, 1);
    expect(result.stage_count).toBe(2);
    expect(result.stage_ratios[0]).toBeCloseTo(9.50, 2);
    expect(result.stage_ratios[1]).toBeCloseTo(7.58, 2);
    expect(result.input_torque_nm).toBeCloseTo(99.47, 1);
    expect(Math.abs(result.output_torque_nm - 6742.5)).toBeLessThanOrEqual(5);
    
    expect(result.service_factor).toBe(1.50);
    expect(Math.abs(result.required_nominal_nm - 10113.8)).toBeLessThanOrEqual(10);
    expect(Math.abs(result.required_maximum_nm - 15170.6)).toBeLessThanOrEqual(15);
  });

  it('should verify Example 13.2: Screw Jack', () => {
    const input = {
      applicationType: ApplicationType.SCREW_JACK,
      loadType: 'uniform' as const,
      dutyHoursPerDay: 8,
      startsPerHour: 1,
      axialLoadN: 35500,
      screwPitchM: 0.006,
      inputRadS: 910 * 2 * Math.PI / 60,
      linearVelocityMS: 0.005,
      serviceFactor: 1.5
    };
    
    const result = GearboxCalculationPipeline.execute(input);
    
    expect(result.total_ratio).toBeCloseTo(18.2, 1);
    expect(result.stage_count).toBe(2);
    expect(result.stage_ratios[0]).toBeCloseTo(3.86, 2);
    expect(result.stage_ratios[1]).toBeCloseTo(4.71, 2);
    
    expect(result.output_torque_nm).toBeCloseTo(84.76, 1);
    expect(result.service_factor).toBe(1.50);
    expect(result.required_nominal_nm).toBeCloseTo(127.1, 0);
    expect(result.required_maximum_nm).toBeCloseTo(190.7, 0);
    
    const T_in = result.output_torque_nm / (result.total_ratio * Math.pow(0.97, 2));
    expect(T_in).toBeCloseTo(4.95, 1);
  });

  it('should verify Example 13.3: Stacker Reclaimer', () => {
    const input = {
      applicationType: ApplicationType.STACKER_RECLAIMER,
      loadType: 'variable' as const,
      dutyHoursPerDay: 12,
      startsPerHour: 4,
      powerW: 30000,
      inputRadS: 1480 * 2 * Math.PI / 60,
      totalRatio: 82.22,
      serviceFactor: 1.75
    };
    
    const result = GearboxCalculationPipeline.execute(input);
    
    expect(result.total_ratio).toBe(82.22);
    expect(result.stage_count).toBe(3);
    
    expect(result.stage_ratios[0]).toBeGreaterThanOrEqual(3.75);
    expect(result.stage_ratios[1]).toBeGreaterThanOrEqual(4.71);
    expect(result.stage_ratios[2]).toBeGreaterThanOrEqual(4.76);
    
    expect(result.input_torque_nm).toBeCloseTo(193.6, 1);
    expect(result.output_torque_nm).toBeCloseTo(14852.7, 1);
    
    expect(result.service_factor).toBe(1.75);
    expect(result.required_nominal_nm).toBeCloseTo(result.output_torque_nm * 1.75, 1);
  });

  it('should verify Example 13.4: Heavy Duty Crusher', () => {
    const input = {
      applicationType: ApplicationType.CRUSHER,
      loadType: 'heavy_shock' as const,
      dutyHoursPerDay: 20,
      startsPerHour: 4,
      powerW: 75000,
      inputRadS: 1480 * 2 * Math.PI / 60,
      outputRadS: 180 * 2 * Math.PI / 60
    };
    
    const result = GearboxCalculationPipeline.execute(input);
    
    expect(result.total_ratio).toBeCloseTo(8.22, 2);
    expect(result.stage_count).toBe(1);
    expect(result.input_torque_nm).toBeCloseTo(483.9, 1);
    expect(Math.abs(result.output_torque_nm - 3854)).toBeLessThanOrEqual(10);
    
    expect(result.service_factor).toBe(2.25);
    expect(result.required_nominal_nm).toBeCloseTo(result.output_torque_nm * 2.25, 0);
    expect(result.required_maximum_nm).toBeCloseTo(result.required_nominal_nm * 2.0, 0);
  });

  describe('Engineering Accuracy Hardening Tests', () => {
    it('should snap derived motor speed to standard speeds', () => {
      const input: any = {
        applicationType: ApplicationType.CONVEYOR,
        loadType: 'uniform' as const,
        dutyHoursPerDay: 8,
        startsPerHour: 1,
        outputRadS: 20 * 2 * Math.PI / 60,
        totalRatio: 73.8
      };
      const result = GearboxCalculationPipeline.execute(input);
      expect(result).toBeDefined();
      expect(input.inputRadS * 60 / (2 * Math.PI)).toBeCloseTo(1450, 0);
    });

    it('should preserve explicit motor speeds (no snapping)', () => {
      const input = {
        applicationType: ApplicationType.CONVEYOR,
        loadType: 'uniform' as const,
        dutyHoursPerDay: 8,
        startsPerHour: 1,
        inputRadS: 1476 * 2 * Math.PI / 60,
        outputRadS: 20 * 2 * Math.PI / 60
      };
      const result = GearboxCalculationPipeline.execute(input);
      expect(result.total_ratio).toBeCloseTo(73.8, 1);
    });

    it('should calculate application-specific service factors', () => {
      const conveyor = GearboxCalculationPipeline.execute({
        applicationType: 'belt conveyor',
        loadType: 'uniform',
        dutyHoursPerDay: 8,
        startsPerHour: 1
      });
      expect(conveyor.service_factor).toBe(1.25);

      const crusher = GearboxCalculationPipeline.execute({
        applicationType: 'heavy crusher',
        loadType: 'uniform',
        dutyHoursPerDay: 8,
        startsPerHour: 1
      });
      expect(crusher.service_factor).toBe(2.0);
    });

    it('should override stage efficiency with user-specified overall efficiency', () => {
      const input = {
        applicationType: ApplicationType.CONVEYOR,
        loadType: 'uniform' as const,
        dutyHoursPerDay: 8,
        startsPerHour: 1,
        outputTorqueNm: 1000,
        totalRatio: 10,
        efficiency: 0.90
      };
      const result = GearboxCalculationPipeline.execute(input);
      expect(result.overall_efficiency).toBe(0.90);
      expect(result.input_torque_nm).toBeCloseTo(1000 / (10 * 0.90), 1);
    });

    it('should compute tiered confidence levels based on assumptions', () => {
      const high = GearboxCalculationPipeline.execute({
        applicationType: ApplicationType.CONVEYOR,
        loadType: 'uniform',
        dutyHoursPerDay: 8,
        startsPerHour: 1,
        powerW: 15000,
        inputRadS: 1450 * 2 * Math.PI / 60,
        totalRatio: 72.5,
        serviceFactor: 1.25,
        efficiency: 0.94
      });
      expect(high.confidence).toBe('HIGH');

      const medium = GearboxCalculationPipeline.execute({
        applicationType: ApplicationType.CONVEYOR,
        loadType: 'uniform',
        dutyHoursPerDay: 8,
        startsPerHour: 1,
        powerW: 15000,
        inputRadS: 1450 * 2 * Math.PI / 60,
        totalRatio: 72.5,
        efficiency: 0.94
      });
      expect(medium.confidence).toBe('MEDIUM');

      const low = GearboxCalculationPipeline.execute({
        applicationType: ApplicationType.CONVEYOR,
        loadType: 'uniform',
        dutyHoursPerDay: 8,
        startsPerHour: 1,
        powerW: 15000,
        inputRadS: 1450 * 2 * Math.PI / 60,
        totalRatio: 72.5
      });
      expect(low.confidence).toBe('LOW');
    });
  });
});
