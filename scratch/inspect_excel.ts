import * as XLSX from 'xlsx';
import * as path from 'path';

const projectRoot = process.cwd();
const xlsxLib: any = XLSX.readFile ? XLSX : (XLSX as any).default;

const file1 = path.join(projectRoot, 'server/data/MAGTORQ_Engineering_Data.xlsx');
const file2 = path.join(projectRoot, 'server/data/MAGTORQ_Gearbox_Database_Updated.xlsx');

console.log('=== FILE 1: MAGTORQ_Engineering_Data.xlsx ===');
if (xlsxLib.readFile) {
  const wb1 = xlsxLib.readFile(file1);
  console.log('Sheets:', wb1.SheetNames);
  wb1.SheetNames.forEach(sheetName => {
    const sheet = wb1.Sheets[sheetName];
    const rows = xlsxLib.utils.sheet_to_json(sheet);
    console.log(`Sheet: ${sheetName}, Rows: ${rows.length}`);
    if (rows.length > 0) {
      console.log('First Row Keys:', Object.keys(rows[0]));
      console.log('First Row Value:', rows[0]);
    }
  });
}

console.log('\n=== FILE 2: MAGTORQ_Gearbox_Database_Updated.xlsx ===');
if (xlsxLib.readFile) {
  const wb2 = xlsxLib.readFile(file2);
  console.log('Sheets:', wb2.SheetNames);
  wb2.SheetNames.forEach(sheetName => {
    const sheet = wb2.Sheets[sheetName];
    const rows = xlsxLib.utils.sheet_to_json(sheet);
    console.log(`Sheet: ${sheetName}, Rows: ${rows.length}`);
    if (rows.length > 0) {
      console.log('First Row Keys:', Object.keys(rows[0]));
      console.log('First Row Value:', rows[0]);
    }
  });
}
