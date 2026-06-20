export interface UnitConversionResult {
  originalValue: number;
  originalUnit: string;
  normalizedValue: number;
  normalizedUnit: string;
  formula: string;
  multiplier: number;
}

export class UnitConverter {
  // Normalize units name to a standard lookup key
  private static cleanUnit(unit: string): string {
    const u = unit.trim().toLowerCase()
      .replace(/[·\-\.]/g, '') // remove dot, dash, middle dot
      .replace(/\s+/g, '');
    
    // Power mapping
    if (['kw', 'kilowatt', 'kilowatts'].includes(u)) return 'kw';
    if (['hp', 'horsepower', 'horse-power'].includes(u)) return 'hp';
    if (['w', 'watt', 'watts'].includes(u)) return 'w';

    // Speed mapping
    if (['rpm', 'revolutionsperminute', 'rev/min', 'revs/min'].includes(u)) return 'rpm';
    if (['rph', 'revolutionsperhour', 'rev/hour', 'revs/hour'].includes(u)) return 'rph';
    if (['rad/s', 'rads', 'radian/s', 'radians/s', 'rad/sec'].includes(u)) return 'rads';

    // Torque mapping
    if (['nm', 'newtonmeter', 'newtonmeters', 'newton·meter', 'newton-meter'].includes(u)) return 'nm';
    if (['kgfm', 'kgm', 'kilogramforcemeter', 'kilogrammeter'].includes(u)) return 'kgfm';
    if (['inlbs', 'inchpounds'].includes(u)) return 'inlbs';
    if (['lbft', 'footpounds', 'ftlbf'].includes(u)) return 'lbft';

    // Force mapping
    if (['n', 'newton', 'newtons'].includes(u)) return 'n';
    if (['kn', 'kilonewton', 'kilonewtons'].includes(u)) return 'kn';
    if (['kgf'].includes(u)) return 'kgf';

    // Dimension mapping
    if (['m', 'meter', 'meters'].includes(u)) return 'm';
    if (['mm', 'millimeter', 'millimeters'].includes(u)) return 'mm';

    return u;
  }

  public static convert(value: number, fromUnit: string): UnitConversionResult {
    const cleaned = this.cleanUnit(fromUnit);
    let normalizedValue = value;
    let normalizedUnit = fromUnit;
    let formula = 'value';
    let multiplier = 1;

    switch (cleaned) {
      // Power -> W (SI)
      case 'kw':
        normalizedValue = value * 1000;
        normalizedUnit = 'W';
        formula = 'value * 1000';
        multiplier = 1000;
        break;
      case 'hp':
        normalizedValue = value * 745.7;
        normalizedUnit = 'W';
        formula = 'value * 745.7';
        multiplier = 745.7;
        break;
      case 'w':
        normalizedValue = value;
        normalizedUnit = 'W';
        formula = 'value';
        multiplier = 1;
        break;

      // Speed -> rad/s (SI)
      case 'rpm':
        normalizedValue = value * (2 * Math.PI) / 60;
        normalizedUnit = 'rad/s';
        formula = 'value * 2 * pi / 60';
        multiplier = (2 * Math.PI) / 60;
        break;
      case 'rph':
        normalizedValue = (value / 60) * (2 * Math.PI) / 60;
        normalizedUnit = 'rad/s';
        formula = '(value / 60) * 2 * pi / 60';
        multiplier = (2 * Math.PI) / 3600;
        break;
      case 'rads':
        normalizedValue = value;
        normalizedUnit = 'rad/s';
        formula = 'value';
        multiplier = 1;
        break;

      // Torque -> N·m (SI)
      case 'nm':
        normalizedValue = value;
        normalizedUnit = 'N·m';
        formula = 'value';
        multiplier = 1;
        break;
      case 'kgfm':
        normalizedValue = value * 9.80665;
        normalizedUnit = 'N·m';
        formula = 'value * 9.80665';
        multiplier = 9.80665;
        break;
      case 'inlbs':
        normalizedValue = value * 0.1129848;
        normalizedUnit = 'N·m';
        formula = 'value * 0.1129848';
        multiplier = 0.1129848;
        break;
      case 'lbft':
        normalizedValue = value * 1.355818;
        normalizedUnit = 'N·m';
        formula = 'value * 1.355818';
        multiplier = 1.355818;
        break;

      // Force -> N (SI)
      case 'n':
        normalizedValue = value;
        normalizedUnit = 'N';
        formula = 'value';
        multiplier = 1;
        break;
      case 'kn':
        normalizedValue = value * 1000;
        normalizedUnit = 'N';
        formula = 'value * 1000';
        multiplier = 1000;
        break;
      case 'kgf':
        normalizedValue = value * 9.80665;
        normalizedUnit = 'N';
        formula = 'value * 9.80665';
        multiplier = 9.80665;
        break;

      // Dimension -> m (SI)
      case 'm':
        normalizedValue = value;
        normalizedUnit = 'm';
        formula = 'value';
        multiplier = 1;
        break;
      case 'mm':
        normalizedValue = value / 1000;
        normalizedUnit = 'm';
        formula = 'value / 1000';
        multiplier = 0.001;
        break;
    }

    return {
      originalValue: value,
      originalUnit: fromUnit,
      normalizedValue,
      normalizedUnit,
      formula,
      multiplier
    };
  }
}
