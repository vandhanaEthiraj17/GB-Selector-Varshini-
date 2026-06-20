import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { EngineeringDatabaseService } from './src/services/EngineeringDatabaseService';
import { selectGearboxSync } from './src/services/engineeringReasoningEngine';

const projectRoot = process.cwd();
const excelPath = path.join(projectRoot, 'server/data/MAGTORQ_Gearbox_Database_Updated.xlsx');

async function runAudit() {
  console.log('=== Excel Database Usage Audit ===');
  
  // Ensure database service is initialized
  await EngineeringDatabaseService.init();

  // Test Case: Required Nominal Torque = 201 Nm, Required Maximum = 201 Nm
  const testNominal = 201;
  const testMax = 201;
  const targetRatio = 4.5; // Changed from 6.25 to 4.5 to correctly match 'L' series first-stage gearbox bounds (<= 5.05)

  console.log('\n[1] Running baseline selection...');
  const baselineGb = selectGearboxSync('s1', testNominal, testMax, 0, targetRatio);
  console.log(`  Selected Gearbox: Size=${baselineGb.size}, Nominal Torque=${baselineGb.nominal} N·m, Rated Torque=${baselineGb.rated} N·m`);

  // Verify it selected L110
  if (baselineGb.size !== 'L110') {
    console.warn(`  Warning: Expected L110, but got ${baselineGb.size}`);
  }

  console.log('\n[2] Programmatically modifying Excel file on disk...');
  console.log(`  Target File: ${excelPath}`);
  
  // Resolve XLSX function mappings safely for ESM/CJS interop
  const xlsxLib: any = XLSX.readFile ? XLSX : (XLSX as any).default;
  if (!xlsxLib || typeof xlsxLib.readFile !== 'function') {
    console.error('XLSX module contents:', Object.keys(XLSX), 'default keys:', XLSX.default ? Object.keys(XLSX.default) : 'none');
    throw new Error('XLSX.readFile is not a function under current import bindings.');
  }

  // Read workbook
  const wb = xlsxLib.readFile(excelPath);
  const sheet = wb.Sheets['Gearboxes'];
  const data = xlsxLib.utils.sheet_to_json(sheet);

  // Find L110 and modify Nominal Torque to 10 N·m
  let found = false;
  for (const row of data as any[]) {
    if (row.Size === 'L110' || row.size === 'L110') {
      row['Nominal Torque'] = 10;
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error('Could not find L110 record in Excel database!');
  }

  // Backup original file
  const backupPath = `${excelPath}.audit.bak`;
  fs.copyFileSync(excelPath, backupPath);

  // Write modified workbook back to disk
  const newSheet = xlsxLib.utils.json_to_sheet(data);
  wb.Sheets['Gearboxes'] = newSheet;
  xlsxLib.writeFile(wb, excelPath);
  console.log('  Excel file written with modified L110 nominal torque (330 -> 10 N·m).');

  // Reload cache
  console.log('\n[3] Re-initializing EngineeringDatabaseService (clearing & reloading cache)...');
  await EngineeringDatabaseService.init(true); // force reload

  // Run selection again
  console.log('\n[4] Running post-modification selection...');
  const postGb = selectGearboxSync('s1', testNominal, testMax, 0, targetRatio);
  console.log(`  Selected Gearbox: Size=${postGb.size}, Nominal Torque=${postGb.nominal} N·m, Rated Torque=${postGb.rated} N·m`);

  // Restore database
  console.log('\n[5] Restoring original Excel database from backup...');
  fs.copyFileSync(backupPath, excelPath);
  fs.unlinkSync(backupPath);
  console.log('  Database restored.');

  // Reload cache to leave workspace clean
  await EngineeringDatabaseService.init(true); // force reload
  console.log('\n=== Audit Complete ===');
}

runAudit().catch(console.error);

