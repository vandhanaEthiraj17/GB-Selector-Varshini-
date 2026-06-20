export interface ExtractionResult {
  projectName: string | null;
  powerW: number | null;
  inputRadS: number | null;
  outputRadS: number | null;
  targetRatio: number | null;
  outputTorqueNm?: number | null;
  inputTorqueNm?: number | null;
  applicationType: string | null;
  serviceFactor: number | null;
  numberOfStages: number | null;
  serviceFactorCondition?: string | null;
}

export interface AnalysisResponse {
  extracted: ExtractionResult;
  report: any;
  verification: any;
  lineage?: any;
  rawText?: string;
}

/**
 * Sends extracted specifications text to the backend proxy for AI analysis.
 * This is decoupled from the UI to support future integrations with ERP/CRM.
 */
export async function analyzeRequirement(
  text: string,
  fileData?: string | null,
  mimeType?: string | null
): Promise<AnalysisResponse> {
  const response = await fetch('/api/analyze-requirement', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, fileData, mimeType }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
  }

  const result: AnalysisResponse = await response.json();
  return result;
}

