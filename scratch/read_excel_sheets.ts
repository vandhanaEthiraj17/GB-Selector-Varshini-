import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const projectRoot = process.cwd();
const file1 = path.join(projectRoot, 'server/data/MAGTORQ_Engineering_Data.xlsx.bak');
const file2 = path.join(projectRoot, 'server/data/MAGTORQ_Gearbox_Database_Updated.xlsx.bak');

const xlsxLib: any = typeof XLSX.readFile !== 'undefined' ? XLSX : (XLSX as any).default;

console.log('File1 exists:', fs.existsSync(file1));
if (fs.existsSync(file1)) {
  const wb = xlsxLib.readFile(file1);
  console.log('File1 sheets:', wb.SheetNames);
}

console.log('File2 exists:', fs.existsSync(file2));
if (fs.existsSync(file2)) {
  const wb = xlsxLib.readFile(file2);
  console.log('File2 sheets:', wb.SheetNames);
}
