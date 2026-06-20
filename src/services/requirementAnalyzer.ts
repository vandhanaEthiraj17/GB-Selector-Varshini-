import { ProjectInput } from '../types/ProjectInput';

/**
 * Service to analyze textual design specifications and extract operating and design parameters.
 * Structured asynchronously to model future AI endpoint integration.
 */
export async function analyzeRequirementText(text: string): Promise<Partial<ProjectInput>> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));

  let powerW: number | undefined;
  let inputRadS: number | undefined;
  let totalRatio: number | undefined;
  let stages: number | undefined;
  let serviceFactor: number | undefined;

  // 1. Extract Power in kW
  const powerMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kW|kilowatt|kilowatts)/i);
  if (powerMatch) {
    powerW = parseFloat(powerMatch[1]) * 1000;
  }

  // 2. Extract Input Speed in RPM
  let extractedInputRPM: number | undefined;
  const inputSpeedMatch = text.match(/(?:(?:input|motor|inlet|high\s+speed\s+shaft|synchronous|prime\s+mover|driver|hss)\s+speed|hss)\s*[:=\s]*\s*(?:is\s+)?\s*(\d+(?:\.\d+)?)\s*RPM/i);
  
  // Exclude output speed terms from rpmMatches
  const rpmMatches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*RPM/gi)]
    .filter(match => {
      const matchText = match[0].toLowerCase();
      const startIndex = Math.max(0, match.index! - 30);
      const context = text.slice(startIndex, match.index! + match[0].length + 30).toLowerCase();
      if (context.includes('driven speed') || context.includes('driven') || context.includes('output') || context.includes('lss') || context.includes('low speed') || context.includes('drum speed') || context.includes('equipment speed')) {
        return false;
      }
      return true;
    });
  
  if (inputSpeedMatch) {
    const matchText = inputSpeedMatch[0].toLowerCase();
    if (!matchText.includes('driven speed') && !matchText.includes('driven') && !matchText.includes('output') && !matchText.includes('lss') && !matchText.includes('low speed') && !matchText.includes('drum speed') && !matchText.includes('equipment speed')) {
      extractedInputRPM = parseFloat(inputSpeedMatch[1]);
    }
  }
  
  if (!extractedInputRPM && rpmMatches.length > 0) {
    extractedInputRPM = parseFloat(rpmMatches[0][1]);
  }

  if (extractedInputRPM) {
    inputRadS = extractedInputRPM * (2 * Math.PI) / 60;
  }

  // 3. Extract Output Speed / Ratio
  const outputSpeedMatch = text.match(/(?:output|target|final|required|conveyor|driven\s+equipment|driven|low\s+speed\s+shaft|lss|drum|equipment)\s+speed\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*RPM/i);
  let resolvedOutputRPM: number | undefined;
  if (outputSpeedMatch) {
    const matchText = outputSpeedMatch[0].toLowerCase();
    if (!matchText.includes('input') && !matchText.includes('motor') && !matchText.includes('inlet') && !matchText.includes('sync') && !matchText.includes('high speed') && !matchText.includes('hss') && !matchText.includes('driver') && !matchText.includes('prime mover')) {
      resolvedOutputRPM = parseFloat(outputSpeedMatch[1]);
    }
  }

  if (resolvedOutputRPM && extractedInputRPM) {
    if (resolvedOutputRPM > 0) {
      totalRatio = parseFloat((extractedInputRPM / resolvedOutputRPM).toFixed(2));
    }
  } else {
    // Check for direct ratio mention like "ratio of 50" or "gear ratio is 45" or "10 : 1"
    const ratioMatch = text.match(/(?:gear\s+)?ratio\s*(?:of|is|target|[:=])?\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)\s*:\s*1/i);
    if (ratioMatch) {
      totalRatio = parseFloat(ratioMatch[1]);
    }
  }

  // 4. Extract Service Factor
  let serviceFactorCondition: string | null = null;
  const sfCondRegex = /(?:service\s+factor|SF|factor|application\s+factor|duty\s+factor|fb|service\s+coefficient|load\s+factor|application\s+service\s+factor|agma\s+service\s+factor|required\s+service\s+factor|minimum\s+service\s+factor|design\s+service\s+factor)\s*[:=\s]*\s*(?:is\s+|of\s+)?\s*(less\s+than|greater\s+than|equal\s+to|minimum|maximum|min\b|max\b|<=|>=|<|>|=)\s*(?:is\s+|of\s+)?\s*(\d+(?:\.\d+)?)/i;
  const sfCondMatch = text.match(sfCondRegex);

  if (sfCondMatch) {
    const condRaw = sfCondMatch[1].toLowerCase();
    if (condRaw === 'less than' || condRaw === '<' || condRaw === '<=') {
      serviceFactorCondition = 'less than';
    } else if (condRaw === 'greater than' || condRaw === '>' || condRaw === '>=') {
      serviceFactorCondition = 'greater than';
    } else if (condRaw === 'equal to' || condRaw === '=') {
      serviceFactorCondition = 'equal to';
    } else if (condRaw === 'minimum' || condRaw === 'min') {
      serviceFactorCondition = 'minimum';
    } else if (condRaw === 'maximum' || condRaw === 'max') {
      serviceFactorCondition = 'maximum';
    }
    serviceFactor = parseFloat(sfCondMatch[2]);
  } else {
    const sfSimpleMatch = text.match(/(?:service\s+factor|SF|factor|application\s+factor|duty\s+factor|fb|service\s+coefficient|load\s+factor|application\s+service\s+factor|agma\s+service\s+factor|required\s+service\s+factor|minimum\s+service\s+factor|design\s+service\s+factor)\s*[:=\s]*\s*(?:of\s+|is\s+)?\s*(\d+(?:\.\d+)?)/i);
    if (sfSimpleMatch) {
      serviceFactor = parseFloat(sfSimpleMatch[1]);
    }
  }

  // 5. Extract stages if mentioned e.g. "3 stages" or "2-stage"
  const stageMatch = text.match(/(\d+)\s*(?:stage|reduction)/i);
  if (stageMatch) {
    stages = parseInt(stageMatch[1], 10);
  }

  // Return extracted values without setting fallbacks if they could not be identified
  return {
    projectName: "AI Analysis: " + (text.split(/[.!?]/)[0]?.substring(0, 30) || "Extracted"),
    powerW,
    inputRadS,
    totalRatio,
    stages,
    serviceFactor,
    serviceFactorCondition,
  };
}

/**
 * Service to process uploaded documents (PDF, DOCX, TXT) and run extraction.
 */
export async function analyzeRequirementFile(file: File): Promise<Partial<ProjectInput>> {
  // Simulate document upload and text parsing latency
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Mock extracted text from document structure
  const mockText = `Uploaded document: ${file.name}. Specifications details: 
  The drivetrain requires a motor power output of 30 kW. 
  The primary motor operating speed runs at 1440 RPM. 
  Our target output velocity for this stage is 24 RPM. 
  We prefer a 3 reduction stage configuration. 
  The service factor requirements call for a value of 1.35.`;
  
  return analyzeRequirementText(mockText);
}
