/**
 * MAGTORQ Gearbox Type
 * Extended with mechanical configuration fields for mounting, shaft, frame, and adapter filtering.
 */

export type MountingType = 'Foot' | 'Flange' | 'Hollow Shaft' | 'Torque Arm' | null;
export type ShaftType = 'Solid' | 'Hollow' | 'Splined' | null;

export interface Gearbox {
  size: string;
  series: number;
  nominal: number;
  rated: number;
  /** Mounting configuration — null if not specified in catalog */
  mounting?: MountingType;
  /** Output shaft type — null if not specified */
  shaft?: ShaftType;
  /** Nominal frame size (housing OD in mm) — null if not specified */
  frame?: number | null;
  /** Whether an adapter plate is included — null if not specified */
  adapter?: boolean | null;
  /** Thermal continuous rating capacity in kW */
  thermal_capacity_kw?: number;
  /** Axial thrust load capacity rating in kN */
  thrust_load_rating_kn?: number;
}

/** Mechanical configuration filter selections */
export interface MechanicalFilters {
  mounting: MountingType | 'Any';
  shaft: ShaftType | 'Any';
  frameMin: number | null;
  frameMax: number | null;
  adapterRequired: boolean | null; // null = Any
}

export const DEFAULT_MECHANICAL_FILTERS: MechanicalFilters = {
  mounting: 'Any',
  shaft: 'Any',
  frameMin: null,
  frameMax: null,
  adapterRequired: null,
};

export interface GearboxInput {
  powerW?: number;
  powerHP?: number;
  inputRadS?: number;
  outputRadS?: number;
  inputTorqueNm?: number;
  outputTorqueNm?: number;
  totalRatio?: number;
  serviceFactor?: number;
  applicationType: string;
  loadType: 'uniform' | 'variable' | 'heavy_shock';
  dutyHoursPerDay: number;
  startsPerHour: number;
  frequencyHz?: 50 | 60;
  motorPoles?: 2 | 4 | 6 | 8 | 10 | 12;
  linearVelocityMS?: number;
  screwPitchM?: number;
  axialLoadN?: number;
  strokeM?: number;
  efficiency?: number;
  mountingPosition?: 'horizontal' | 'vertical_up' | 'vertical_down';
  axialThrustLoadN?: number;
  ambientTemperatureK?: number;
}

