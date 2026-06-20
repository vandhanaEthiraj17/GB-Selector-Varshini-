import { UnitConverter } from './UnitConverter';

export interface LineageParameter<T> {
  value: T | null;
  originalValue: string | null;
  originalUnit: string | null;
  normalizedValue: T | null;
  normalizedUnit: string | null;
  sourceLocation: string;
  method: 'REGEX_PROXIMITY' | 'AI_GEMINI' | 'LOCAL_OCR';
  confidence: 'High' | 'Medium' | 'Low';
  originalTextFragment: string;
  auditExplanation: string;
}

export interface ExtractedSpecs {
  projectName: LineageParameter<string>;
  powerKW: LineageParameter<number>;
  inputRPM: LineageParameter<number>;
  outputRPM: LineageParameter<number>;
  totalRatio: LineageParameter<number>;
  serviceFactor: LineageParameter<number>;
  stages: LineageParameter<number>;
  motorHP: LineageParameter<number>;
  motorPoles: LineageParameter<number>;
  outputTorqueNm: LineageParameter<number>;
  inputTorqueNm: LineageParameter<number>;
  applicationType: LineageParameter<string>;
}

interface GridCell {
  text: string;
  row: number;
  col: number;
}

export class LayoutAwareProximityParser {
  private static parseNumberWithUnit(text: string): { value: number; unit: string } | null {
    // Matches e.g. "90 kW", "1440 RPM", "72", "15 HP", "94000 Nm"
    const match = text.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z\u00B7\u2022\-\.\/0-9]+)?$/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const unit = match[2] ? match[2].trim() : '';
    return { value, unit };
  }

  private static matchAnchor(cellText: string, anchor: string, parameterName: string): boolean {
    const lowerText = cellText.toLowerCase();
    const lowerAnchor = anchor.toLowerCase();
    
    if (!lowerText.includes(lowerAnchor)) {
      return false;
    }

    // List of generic anchors and their exclusions
    if (parameterName === 'inputRPM') {
      if (lowerText.includes('driven speed') || lowerText.includes('driven') || lowerText.includes('output') || lowerText.includes('lss') || lowerText.includes('low speed') || lowerText.includes('equipment')) {
        return false;
      }
      if (['speed', 'rpm'].includes(lowerAnchor)) {
        const exclusions = ['output', 'target', 'conveyor', 'shaft', 'final', 'low', 'drum', 'driven', 'lss', 'low speed', 'equipment'];
        if (exclusions.some(exc => lowerText.includes(exc))) {
          return false;
        }
      }
    }

    if (parameterName === 'outputRPM') {
      if (lowerText.includes('input') || lowerText.includes('motor') || lowerText.includes('inlet') || lowerText.includes('sync') || lowerText.includes('high speed') || lowerText.includes('hss') || lowerText.includes('driver') || lowerText.includes('prime mover')) {
        return false;
      }
      if (['speed', 'rpm'].includes(lowerAnchor)) {
        const exclusions = ['input', 'motor', 'inlet', 'sync', 'poles', 'high', 'hss', 'high speed', 'driver', 'prime mover'];
        if (exclusions.some(exc => lowerText.includes(exc))) {
          return false;
        }
      }
    }

    if (parameterName === 'outputTorqueNm' && lowerAnchor === 'torque') {
      const exclusions = ['input', 'motor'];
      if (exclusions.some(exc => lowerText.includes(exc))) {
        return false;
      }
    }

    if (parameterName === 'inputTorqueNm' && lowerAnchor === 'torque') {
      const exclusions = ['output', 'final', 'load'];
      if (exclusions.some(exc => lowerText.includes(exc))) {
        return false;
      }
    }

    return true;
  }

  private static searchGrid(grid: GridCell[][], anchors: string[], expectedUnits: string[], name: string): { value: number; unit: string; location: string; fragment: string; confidence: 'High' | 'Medium' | 'Low'; matchedAnchor?: string } | null {
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        
        const matchedAnchor = anchors.find(anchor => this.matchAnchor(cell.text, anchor, name));
        if (matchedAnchor) {
          // 1. Check cell itself (e.g. "Power: 15 kW")
          const inlineMatch = cell.text.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z\u00B7\u2022\-\.\/0-9]+)?/);
          if (inlineMatch) {
            const val = parseFloat(inlineMatch[1]);
            const unit = inlineMatch[2] ? inlineMatch[2].trim() : '';
            if (expectedUnits.includes(unit.toLowerCase()) || expectedUnits.length === 0 || (expectedUnits.includes('') && unit === '')) {
              return {
                value: val,
                unit,
                location: `Row ${cell.row + 1}, Col ${cell.col + 1}`,
                fragment: cell.text,
                confidence: 'High',
                matchedAnchor
              };
            }
          }

          // 2. Check cell to the right (same row, next column)
          if (c + 1 < row.length) {
            const rightCell = row[c + 1];
            const parsed = this.parseNumberWithUnit(rightCell.text);
            if (parsed) {
              const matchesUnit = expectedUnits.length === 0 || expectedUnits.includes(parsed.unit.toLowerCase());
              return {
                value: parsed.value,
                unit: parsed.unit,
                location: `Row ${rightCell.row + 1}, Col ${rightCell.col + 1} (Right of '${cell.text}')`,
                fragment: `${cell.text} | ${rightCell.text}`,
                confidence: matchesUnit ? 'High' : 'Medium',
                matchedAnchor
              };
            }
          }

          // 3. Check cell below (same column, next row)
          if (r + 1 < grid.length) {
            const nextRow = grid[r + 1];
            const belowCell = nextRow.find(cellBelow => cellBelow.col === cell.col);
            if (belowCell) {
              const parsed = this.parseNumberWithUnit(belowCell.text);
              if (parsed) {
                const matchesUnit = expectedUnits.length === 0 || expectedUnits.includes(parsed.unit.toLowerCase());
                return {
                  value: parsed.value,
                  unit: parsed.unit,
                  location: `Row ${belowCell.row + 1}, Col ${belowCell.col + 1} (Below '${cell.text}')`,
                  fragment: `${cell.text} \n ${belowCell.text}`,
                  confidence: matchesUnit ? 'High' : 'Medium',
                  matchedAnchor
                };
              }
            }
          }
        }
      }
    }
    return null;
  }

  private static searchFlatTextProximity(text: string, anchors: string[], expectedUnits: string[], name: string): { value: number; unit: string; location: string; fragment: string; confidence: 'High' | 'Medium' | 'Low'; matchedAnchor?: string } | null {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matchedAnchor = anchors.find(anchor => this.matchAnchor(line, anchor, name));
      
      if (matchedAnchor) {
        // Look for number + unit in the line
        // Matches e.g. "motor 15kw", "speed: 1440rpm", "ratio 72:1"
        const regexStr = expectedUnits.length > 0 
          ? `(\\d+(?:\\.\\d+)?)\\s*(${expectedUnits.map(u => u.replace('.', '\\.')).join('|')})\\b`
          : `(\\d+(?:\\.\\d+)?)\\s*([a-zA-Z\\u00B7\\u2022\\-\\.\\/0-9]*)`;
        
        const regex = new RegExp(regexStr, 'i');
        const match = line.match(regex);
        if (match) {
          return {
            value: parseFloat(match[1]),
            unit: match[2] ? match[2].trim() : '',
            location: `Line ${i + 1}`,
            fragment: line.trim(),
            confidence: 'High',
            matchedAnchor
          };
        }

        // Generic number lookup as fallback
        const genericMatch = line.match(/(\d+(?:\.\d+)?)/);
        if (genericMatch) {
          return {
            value: parseFloat(genericMatch[1]),
            unit: '',
            location: `Line ${i + 1} (Generic numeric match)`,
            fragment: line.trim(),
            confidence: 'Low',
            matchedAnchor
          };
        }
      }
    }
    return null;
  }

  private static createMissingParameter<T>(name: string, explanation: string): LineageParameter<T> {
    return {
      value: null,
      originalValue: null,
      originalUnit: null,
      normalizedValue: null,
      normalizedUnit: null,
      sourceLocation: 'None',
      method: 'REGEX_PROXIMITY',
      confidence: 'Low',
      originalTextFragment: 'N/A',
      auditExplanation: `MISSING: ${explanation}`
    };
  }

  public static parse(rawText: string): ExtractedSpecs {
    // 1. Grid detection
    const lines = rawText.split('\n');
    const grid: GridCell[][] = [];
    for (let r = 0; r < lines.length; r++) {
      const line = lines[r];
      // Splitting by tabs or 2+ spaces (which are common in table layouts)
      const cells = line.split(/\s{2,}|\t+/).map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length > 0) {
        grid.push(cells.map((text, c) => ({ text, row: r, col: c })));
      }
    }

    const resolveParameter = (
      name: string,
      anchors: string[],
      expectedUnits: string[],
      siUnit: string
    ): LineageParameter<number> => {
      // Step A: Search grid first
      let resolved = this.searchGrid(grid, anchors, expectedUnits, name);
      
      // Step B: Search flat text if grid search yielded nothing
      if (!resolved) {
        resolved = this.searchFlatTextProximity(rawText, anchors, expectedUnits, name);
      }

      if (resolved) {
        // Run SI Unit Conversion
        const conv = UnitConverter.convert(resolved.value, resolved.unit || siUnit);
        const resultParam = {
          value: conv.originalValue,
          originalValue: resolved.value.toString(),
          originalUnit: resolved.unit || null,
          normalizedValue: conv.normalizedValue,
          normalizedUnit: conv.normalizedUnit,
          sourceLocation: resolved.location,
          method: 'REGEX_PROXIMITY' as const,
          confidence: resolved.confidence,
          originalTextFragment: resolved.fragment,
          auditExplanation: resolved.unit 
            ? `Extracted value ${resolved.value} and unit '${resolved.unit}'. Converted to ${conv.normalizedValue} ${conv.normalizedUnit} via: ${conv.formula}.`
            : `Extracted raw value ${resolved.value} (no unit). Normalizing to standard ${conv.normalizedValue} ${conv.normalizedUnit}.`
        };
        if (name === 'serviceFactor') {
          console.log(`[SF TRACE] Alias Matched: ${resolved.matchedAnchor}`);
          console.log(`[SF TRACE] Value Extracted: ${resultParam.value} from ${resolved.location}`);
          console.log("[SF TRACE]", {
            stage: "LayoutAwareProximityParser",
            value: resultParam.value,
            source: resolved.location
          });
        }
        return resultParam;
      }

      if (name === 'serviceFactor') {
        console.log("[SF TRACE]", {
          stage: "LayoutAwareProximityParser",
          value: null,
          source: "unextracted"
        });
      }
      return this.createMissingParameter<number>(name, `Could not find any numeric value close to parameter anchors: [${anchors.join(', ')}].`);
    };

    // Extract Application Type
    const appAnchors = ['conveyor', 'mixer', 'crusher', 'agitator', 'winch', 'hoist', 'pump', 'fan', 'jack', 'thickener', 'clarifier', 'reactor', 'apron feeder', 'chain conveyor'];
    let appVal = 'CONVEYOR';
    let appLineage: LineageParameter<string>;
    let appMatch = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = appAnchors.find(a => line.toLowerCase().includes(a));
      if (match) {
        let mappedVal = match.toUpperCase();
        if (['THICKENER', 'CLARIFIER', 'REACTOR'].includes(mappedVal)) {
          mappedVal = 'MIXER';
        } else if (['APRON FEEDER', 'CHAIN CONVEYOR'].includes(mappedVal)) {
          mappedVal = 'CONVEYOR';
        }
        appMatch = { value: mappedVal, location: `Line ${i + 1}`, fragment: line.trim() };
        break;
      }
    }

    if (appMatch) {
      appLineage = {
        value: appMatch.value,
        originalValue: appMatch.value,
        originalUnit: null,
        normalizedValue: appMatch.value,
        normalizedUnit: null,
        sourceLocation: appMatch.location,
        method: 'REGEX_PROXIMITY',
        confidence: 'High',
        originalTextFragment: appMatch.fragment,
        auditExplanation: `Matched application type '${appMatch.value}' directly from text.`
      };
    } else {
      appLineage = {
        value: 'CONVEYOR',
        originalValue: 'CONVEYOR',
        originalUnit: null,
        normalizedValue: 'CONVEYOR',
        normalizedUnit: null,
        sourceLocation: 'Default fallback',
        method: 'REGEX_PROXIMITY',
        confidence: 'Low',
        originalTextFragment: 'N/A',
        auditExplanation: 'MISSING: No explicit application keywords found. Fallback set to CONVEYOR.'
      };
    }

    // Extract Project Name
    let projectName = 'MAGTORQ Selection Project';
    let projLineage: LineageParameter<string>;
    const projMatch = rawText.match(/(?:project|ref|rfq|reference)\s*[:=\s]\s*([^\n]+)/i);
    if (projMatch) {
      projectName = projMatch[1].trim();
      projLineage = {
        value: projectName,
        originalValue: projectName,
        originalUnit: null,
        normalizedValue: projectName,
        normalizedUnit: null,
        sourceLocation: 'Regex match',
        method: 'REGEX_PROXIMITY',
        confidence: 'High',
        originalTextFragment: projMatch[0],
        auditExplanation: `Parsed project identifier '${projectName}' directly.`
      };
    } else {
      projLineage = {
        value: projectName,
        originalValue: projectName,
        originalUnit: null,
        normalizedValue: projectName,
        normalizedUnit: null,
        sourceLocation: 'None',
        method: 'REGEX_PROXIMITY',
        confidence: 'Low',
        originalTextFragment: 'N/A',
        auditExplanation: 'MISSING: Project name metadata not found, defaulting.'
      };
    }

    return {
      projectName: projLineage,
      powerKW: resolveParameter('powerKW', ['power', 'motor rating', 'kw rating', 'power kw', 'installed power', 'motor size'], ['kw', 'w', 'hp'], 'kW'),
      inputRPM: resolveParameter('inputRPM', ['input speed', 'motor speed', 'input rpm', 'inlet rpm', 'sync speed', 'poles speed', 'speed', 'rpm', 'hss', 'high speed shaft speed', 'synchronous speed', 'prime mover speed', 'driver speed'], ['rpm', 'rph', 'rad/s'], 'RPM'),
      outputRPM: resolveParameter('outputRPM', ['output speed', 'target speed', 'output rpm', 'conveyor speed', 'shaft speed', 'final speed', 'driven equipment speed', 'driven speed', 'low speed shaft speed', 'lss', 'drum speed', 'equipment speed'], ['rpm', 'rph', 'rad/s'], 'RPM'),
      totalRatio: resolveParameter('totalRatio', ['ratio', 'total ratio', 'gearbox ratio', 'reduction ratio', 'reduction'], [':1', 'ratio', ''], ':1'),
      serviceFactor: resolveParameter('serviceFactor', ['service factor', 'application factor', 'duty factor', 'fb', 'service coefficient', 'load factor', 'application service factor', 'agma service factor', 'required service factor', 'minimum service factor', 'design service factor', 'sf', 'factor', 'safety coefficient'], [], ''),
      stages: resolveParameter('stages', ['stages', 'reductions', 'stage count', 'number of stages'], [], ''),
      motorHP: resolveParameter('motorHP', ['motor hp', 'hp rating', 'horsepower'], ['hp'], 'HP'),
      motorPoles: resolveParameter('motorPoles', ['poles', 'motor poles', 'pole count'], ['poles', 'pole'], 'Poles'),
      outputTorqueNm: resolveParameter('outputTorqueNm', ['output torque', 'torque', 'final torque', 'load torque', 'shaft torque'], ['nm', 'kgfm', 'inlbs', 'lbft'], 'N·m'),
      inputTorqueNm: resolveParameter('inputTorqueNm', ['input torque', 'motor torque', 'shaft input torque'], ['nm', 'kgfm', 'inlbs', 'lbft'], 'N·m'),
      applicationType: appLineage
    };
  }
}
