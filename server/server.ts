import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EngineeringDatabaseService } from './services/EngineeringDatabaseService';
import { generateAuditReport } from '../src/services/engineeringReasoningEngine';
import { verifyEngineeringReport } from '../src/services/verificationEngine';
import { calculateGearboxOptions, getStageDetails } from '../src/services/gearboxCalculator';
import { EngineeringDatabaseService as ClientDbService } from '../src/services/EngineeringDatabaseService';
import { EngineeringDatabaseService as ServerDbService } from './services/EngineeringDatabaseService';
import { LayoutAwareProximityParser } from '../src/services/LayoutAwareProximityParser';
import { UnitConverter } from '../src/services/UnitConverter';

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3001; // Port 3001 as mapped in Vite configuration

app.use(cors());
app.use(express.json({ limit: '20mb' })); // Support larger Excel file uploads and text sizes

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables. The Requirement Analyzer will fail on API calls.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Initialize the Database Cache
EngineeringDatabaseService.initialize().catch(err => {
  console.error("Critical: Failed to initialize Engineering Database Service at startup:", err);
});

// Register backend cache providers to the client database service so that all imported
// calculation modules (which query ClientDbService) will transparently run on the active server cache.
ClientDbService.registerProviders(
  () => ServerDbService.getGearboxes(),
  () => ServerDbService.getSeriesRatios()
);

// Database Summary API Endpoint (Exposes counts only, no catalogue records)
app.get('/api/database/status', (_req, res) => {
  try {
    const gearboxes = ServerDbService.getGearboxes();
    const ratios = ServerDbService.getSeriesRatios();
    const ratioCount = Object.values(ratios).reduce((acc, curr) => acc + curr.length, 0);

    res.json({
      success: true,
      gearboxCount: gearboxes.length,
      ratioCount: ratioCount
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Staging Permutations Sizing API Endpoint
app.post('/api/calculate-sizing', async (req, res) => {
  try {
    const { inputs, numOptions } = req.body;
    if (!inputs) {
      return res.status(400).json({ error: 'Missing parameter: inputs' });
    }
    const results = await calculateGearboxOptions(inputs, numOptions || 5);
    res.json(results);
  } catch (error) {
    console.error('Sizing calculation failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Stage Details Calculation API Endpoint
app.post('/api/stage-details', async (req, res) => {
  try {
    const { inputs, selectedOption } = req.body;
    if (!inputs || !selectedOption) {
      return res.status(400).json({ error: 'Missing parameter: inputs or selectedOption' });
    }
    const details = await getStageDetails(inputs, selectedOption);
    res.json(details);
  } catch (error) {
    console.error('Stage details calculation failed:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Role-Based Endpoint for Database Updates
app.post('/api/database/update', async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.ADMIN_TOKEN || 'magtorq-admin-secret-2026';

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    console.warn(`Unauthorized database update attempt with header: ${authHeader}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid admin credentials.' });
  }

  const { type, fileName, fileData } = req.body;
  if (!type || !fileName || !fileData) {
    return res.status(400).json({ error: 'Missing required parameters: type, fileName, fileData' });
  }

  if (type !== 'engineering_data' && type !== 'gearbox_database') {
    return res.status(400).json({ error: 'Invalid database type. Must be engineering_data or gearbox_database.' });
  }

  try {
    const result = await EngineeringDatabaseService.updateDatabase(type, fileName, fileData);
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

function parseSpecsFallback(text: string) {
  const parsed = LayoutAwareProximityParser.parse(text);
  return {
    projectName: parsed.projectName.value || "Industrial Gearbox Project",
    powerKW: parsed.powerKW.value,
    inputRPM: parsed.inputRPM.value,
    outputRPM: parsed.outputRPM.value,
    targetRatio: parsed.totalRatio.value,
    outputTorqueNm: parsed.outputTorqueNm.value,
    inputTorqueNm: parsed.inputTorqueNm.value,
    applicationType: parsed.applicationType.value || "CONVEYOR",
    serviceFactor: parsed.serviceFactor.value,
    numberOfStages: parsed.stages.value,
    serviceFactorCondition: null
  };
}

// Existing AI Requirement Analyzer Endpoint
app.post('/api/analyze-requirement', async (req, res) => {
  const { text, fileData, mimeType } = req.body;

  if (!text && !fileData) {
    return res.status(400).json({ error: "Missing requirement 'text' or 'fileData' parameter." });
  }

  try {
    let extractedData;
    let lineage;
    let usedFallback = false;

    if (!genAI) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in environment variables. Falling back to layout proximity parser.");
      lineage = LayoutAwareProximityParser.parse(text || "");
      extractedData = {
        projectName: lineage.projectName.value,
        powerKW: lineage.powerKW.value,
        inputRPM: lineage.inputRPM.value,
        outputRPM: lineage.outputRPM.value,
        targetRatio: lineage.totalRatio.value,
        outputTorqueNm: lineage.outputTorqueNm.value,
        inputTorqueNm: lineage.inputTorqueNm.value,
        applicationType: lineage.applicationType.value,
        serviceFactor: lineage.serviceFactor.value,
        numberOfStages: lineage.stages.value,
        serviceFactorCondition: null
      };
      usedFallback = true;
    } else {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
You are an industrial gearbox engineering assistant.
Extract gearbox selection parameters from the provided document (which may contain text, tables, design diagrams, drawings, or blueprints) and/or the text description.
Carefully examine any visual details, tabular data, text values, and motor details in the attached document.
Return ONLY valid JSON matching this schema:
{
  "projectName": string or null,
  "powerKW": number or null,
  "inputRPM": number or null,
  "outputRPM": number or null,
  "targetRatio": number or null,
  "outputTorqueNm": number or null,
  "inputTorqueNm": number or null,
  "applicationType": string or null,
  "serviceFactor": number or null,
  "numberOfStages": number or null
}

Rules:
1. If targetRatio is missing but inputRPM and outputRPM exist:
   targetRatio = inputRPM / outputRPM
2. If serviceFactor is missing:
   Suggest based on application type.
   Conveyor = 1.5
   Mixer = 1.75
   Crusher = 2.0
   Fan = 1.25
   Pump = 1.25
3. If a field is unknown, return null.
4. Return JSON only. Do not wrap in markdown blocks.

${text ? `Text Description/Extracted Text:\n---\n${text}\n---` : ''}
`;

        const parts = [];
        if (fileData && mimeType) {
          parts.push({
            inlineData: {
              data: fileData,
              mimeType: mimeType
            }
          });
        }
        parts.push({ text: prompt });

        let result;
        let attempts = 0;
        const maxAttempts = 3;
        let delay = 1000;

        while (attempts < maxAttempts) {
          try {
            attempts++;
            result = await model.generateContent({
              contents: [{ role: 'user', parts: parts }],
              generationConfig: {
                responseMimeType: "application/json"
              }
            });
            break; // Success
          } catch (err) {
            console.warn(`Gemini API attempt ${attempts} failed:`, (err as Error).message);
            const errMsg = (err as Error).message || "";
            if (attempts >= maxAttempts || errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || (err as any).status === 400 || (err as any).status === 403) {
              throw err;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5;
          }
        }

        const responseText = result.response.text();
        extractedData = JSON.parse(responseText.trim());

        // Map Gemini output to LineageParameter structure
        const mapGeminiLineage = (name: string, val: any, siUnit: string): any => {
          if (val === undefined || val === null) {
            return {
              value: null,
              originalValue: null,
              originalUnit: null,
              normalizedValue: null,
              normalizedUnit: null,
              sourceLocation: "None",
              method: 'AI_GEMINI',
              confidence: 'Low',
              originalTextFragment: 'N/A',
              auditExplanation: `MISSING: Gemini AI did not find this parameter.`
            };
          }
          const conv = UnitConverter.convert(val, siUnit);
          return {
            value: val,
            originalValue: val.toString(),
            originalUnit: siUnit,
            normalizedValue: conv.normalizedValue,
            normalizedUnit: conv.normalizedUnit,
            sourceLocation: "Gemini visual analysis",
            method: 'AI_GEMINI',
            confidence: 'High',
            originalTextFragment: `AI identified value: ${val}`,
            auditExplanation: `Extracted via Gemini multimodal visual analysis. Normalized to ${conv.normalizedValue} ${conv.normalizedUnit}.`
          };
        };

        lineage = {
          projectName: {
            value: extractedData.projectName || 'MAGTORQ AI Project',
            originalValue: extractedData.projectName || null,
            originalUnit: null,
            normalizedValue: extractedData.projectName || 'MAGTORQ AI Project',
            normalizedUnit: null,
            sourceLocation: "Gemini visual analysis",
            method: 'AI_GEMINI',
            confidence: 'High',
            originalTextFragment: `AI identified project name`,
            auditExplanation: "Extracted via Gemini."
          },
          powerKW: mapGeminiLineage('powerKW', extractedData.powerKW, 'kW'),
          inputRPM: mapGeminiLineage('inputRPM', extractedData.inputRPM, 'RPM'),
          outputRPM: mapGeminiLineage('outputRPM', extractedData.outputRPM, 'RPM'),
          totalRatio: mapGeminiLineage('totalRatio', extractedData.targetRatio, ':1'),
          serviceFactor: mapGeminiLineage('serviceFactor', extractedData.serviceFactor, ''),
          stages: mapGeminiLineage('stages', extractedData.numberOfStages, ''),
          motorHP: mapGeminiLineage('motorHP', null, 'HP'),
          motorPoles: mapGeminiLineage('motorPoles', null, 'Poles'),
          outputTorqueNm: mapGeminiLineage('outputTorqueNm', extractedData.outputTorqueNm, 'N·m'),
          inputTorqueNm: mapGeminiLineage('inputTorqueNm', extractedData.inputTorqueNm, 'N·m'),
          applicationType: {
            value: extractedData.applicationType || 'CONVEYOR',
            originalValue: extractedData.applicationType || null,
            originalUnit: null,
            normalizedValue: extractedData.applicationType || 'CONVEYOR',
            normalizedUnit: null,
            sourceLocation: "Gemini visual analysis",
            method: 'AI_GEMINI',
            confidence: 'High',
            originalTextFragment: `AI identified application type`,
            auditExplanation: `Extracted application: ${extractedData.applicationType}`
          }
        };

      } catch (err) {
        console.warn("Gemini API call failed, falling back to layout proximity parser:", (err as Error).message);
        lineage = LayoutAwareProximityParser.parse(text || "");
        extractedData = {
          projectName: lineage.projectName.value,
          powerKW: lineage.powerKW.value,
          inputRPM: lineage.inputRPM.value,
          outputRPM: lineage.outputRPM.value,
          targetRatio: lineage.totalRatio.value,
          outputTorqueNm: lineage.outputTorqueNm.value,
          inputTorqueNm: lineage.inputTorqueNm.value,
          applicationType: lineage.applicationType.value,
          serviceFactor: lineage.serviceFactor.value,
          numberOfStages: lineage.stages.value,
          serviceFactorCondition: null
        };
        usedFallback = true;
      }
    }

    const powerW = (extractedData.powerKW !== undefined && extractedData.powerKW !== null) ? extractedData.powerKW * 1000 : null;
    const inputRadS = (extractedData.inputRPM !== undefined && extractedData.inputRPM !== null) ? extractedData.inputRPM * (2 * Math.PI) / 60 : null;
    const outputRadS = (extractedData.outputRPM !== undefined && extractedData.outputRPM !== null) ? extractedData.outputRPM * (2 * Math.PI) / 60 : null;

    const canonicalOutput = {
      projectName: extractedData.projectName || null,
      powerW,
      inputRadS,
      outputRadS,
      targetRatio: extractedData.targetRatio || extractedData.totalRatio || null,
      outputTorqueNm: extractedData.outputTorqueNm || null,
      inputTorqueNm: extractedData.inputTorqueNm || null,
      applicationType: extractedData.applicationType || null,
      serviceFactor: extractedData.serviceFactor || null,
      numberOfStages: extractedData.numberOfStages || extractedData.stages || null,
      serviceFactorCondition: extractedData.serviceFactorCondition || null
    };

    console.log("[SF TRACE]", {
      stage: "IncomingAPIRequest",
      value: canonicalOutput.serviceFactor,
      source: usedFallback ? "LayoutAwareProximityParser" : "AI_GEMINI"
    });

    console.log(`[POST /api/analyze-requirement] Received request. Text length: ${text?.length || 0}, Has fileData: ${!!fileData}, Used Fallback: ${usedFallback}`);

    // Run backend audit report generation and engineering safety checks
    const solution = generateAuditReport(text || '', canonicalOutput, lineage);
    const verification = verifyEngineeringReport(solution, canonicalOutput);

    console.log(`[POST /api/analyze-requirement] Analysis completed successfully.`);
    res.json({
      extracted: canonicalOutput,
      report: solution,
      verification: verification,
      lineage: lineage,
      rawText: text || ""
    });
  } catch (error) {
    console.error("Gemini API call failed with exception:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    
    let userMessage = "Failed to extract parameters from specifications.";
    const errText = (error as Error).message || "";
    
    if ((error as any).status === 503 || errText.includes("503") || errText.includes("Service Unavailable") || errText.includes("high demand")) {
      userMessage = "The Gemini API is temporarily experiencing high demand (503 Service Unavailable). Please click 'Analyze Requirement' again to retry.";
    } else if ((error as any).status === 429 || errText.includes("429") || errText.includes("quota") || errText.includes("Too Many Requests")) {
      userMessage = "AI rate limit reached (429 Too Many Requests). Please wait a moment and try again.";
    } else {
      userMessage += ` (Details: ${errText})`;
    }
    
    res.status(500).json({ 
      error: userMessage,
      details: errText,
      stack: error instanceof Error ? error.stack : String(error)
    });
  }
});

app.listen(port, () => {
  console.log(`=== MAGTORQ BACKEND STARTUP DIAGNOSTICS ===`);
  console.log(`[1] Backend Port: ${port}`);
  console.log(`[2] Gemini API Initialization Status: ${process.env.GEMINI_API_KEY ? "INITIALIZED (Key Present)" : "FAILED (GEMINI_API_KEY not found in environment)"}`);
  try {
    const gearboxes = ServerDbService.getGearboxes();
    console.log(`[3] Excel Database Status: INITIALIZED (${gearboxes.length} gearboxes cached)`);
  } catch (err) {
    console.log(`[3] Excel Database Status: FAILED (${(err as Error).message})`);
  }
  console.log(`[4] API Route Registration Status:`);
  console.log(`    - GET  /api/database/status: REGISTERED`);
  console.log(`    - POST /api/calculate-sizing: REGISTERED`);
  console.log(`    - POST /api/stage-details: REGISTERED`);
  console.log(`    - POST /api/database/update: REGISTERED`);
  console.log(`    - POST /api/analyze-requirement: REGISTERED`);
  console.log(`===========================================\n`);
  console.log(`MAGTORQ API Backend running at http://localhost:${port}`);
});
