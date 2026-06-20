import { parseInputsWithMetadata } from '../src/services/derivationEngine';
import { generateAuditReport } from '../src/services/engineeringReasoningEngine';
import { LayoutAwareProximityParser } from '../src/services/LayoutAwareProximityParser';
import { EngineeringDatabaseService } from '../server/services/EngineeringDatabaseService';
import { EngineeringDatabaseService as ClientDbService } from '../src/services/EngineeringDatabaseService';

async function test() {
  await EngineeringDatabaseService.initialize();
  ClientDbService.registerProviders(
    () => EngineeringDatabaseService.getGearboxes(),
    () => EngineeringDatabaseService.getSeriesRatios()
  );

  const rawText = "Shaft Speed: 980\nReduction: 122.5\n132 kW\nVelocity: 8\ny: 8\n";
  console.log("--- PARSER RESULT FROM DERIVATION ENGINE ---");
  const parserResult = parseInputsWithMetadata(rawText);
  console.log("Values:", parserResult.values);
  
  console.log("--- PROXIMITY PARSER RESULT ---");
  const proximity = LayoutAwareProximityParser.parse(rawText);
  console.log("Input RPM value:", proximity.inputRPM.value);
  console.log("Output RPM value:", proximity.outputRPM.value);
  console.log("Total Ratio value:", proximity.totalRatio.value);

  console.log("--- AUDIT REPORT GENERATION ---");
  const extractedData = {
    projectName: proximity.projectName.value,
    powerKW: proximity.powerKW.value,
    inputRPM: proximity.inputRPM.value,
    outputRPM: proximity.outputRPM.value,
    targetRatio: proximity.totalRatio.value,
    outputTorqueNm: proximity.outputTorqueNm.value,
    inputTorqueNm: proximity.inputTorqueNm.value,
    applicationType: proximity.applicationType.value,
    serviceFactor: proximity.serviceFactor.value,
    numberOfStages: proximity.stages.value,
    serviceFactorCondition: null
  };

  const powerW = extractedData.powerKW ? extractedData.powerKW * 1000 : null;
  const inputRadS = extractedData.inputRPM ? extractedData.inputRPM * (2 * Math.PI) / 60 : null;
  const outputRadS = extractedData.outputRPM ? extractedData.outputRPM * (2 * Math.PI) / 60 : null;

  const canonicalOutput = {
    projectName: extractedData.projectName || null,
    powerW,
    inputRadS,
    outputRadS,
    targetRatio: extractedData.targetRatio || null,
    outputTorqueNm: extractedData.outputTorqueNm || null,
    inputTorqueNm: extractedData.inputTorqueNm || null,
    applicationType: extractedData.applicationType || null,
    serviceFactor: extractedData.serviceFactor || null,
    numberOfStages: extractedData.numberOfStages || null,
    serviceFactorCondition: null
  };

  const report = generateAuditReport(rawText, canonicalOutput);
  console.log("Report inputRPM:", report.inputRPM);
  console.log("Report outputRPM:", report.outputRPM);
  console.log("Report totalRatio:", report.totalRatio);
  console.log("Traces:");
  console.log(report.derivationTraces);
}

test().catch(console.error);
