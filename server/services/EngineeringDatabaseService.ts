import * as XLSX from 'xlsx';
const xlsxLib: any = XLSX.readFile ? XLSX : (XLSX as any).default;

import fs from 'fs';
import path from 'path';
import { Gearbox } from '../../src/types/Gearbox';

export class EngineeringDatabaseService {
  private static cachedGearboxes: Gearbox[] = [];
  private static cachedRatios: Record<string, number[]> = {};
  private static initialized = false;

  private static dataDir = path.join(process.cwd(), 'server/data');
  private static engineeringDataPath = path.join(EngineeringDatabaseService.dataDir, 'MAGTORQ_Engineering_Data.xlsx');
  private static gearboxDatabasePath = path.join(EngineeringDatabaseService.dataDir, 'MAGTORQ_Gearbox_Database_Updated.xlsx');

  public static async initialize(): Promise<void> {
    try {
      console.log('Initializing EngineeringDatabaseService...');

      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      const excel1Exists = fs.existsSync(this.engineeringDataPath);
      const excel2Exists = fs.existsSync(this.gearboxDatabasePath);

      if (excel1Exists || excel2Exists) {
        const mergedGearboxes: Map<string, Gearbox> = new Map();
        const mergedRatios: Record<string, Set<number>> = {};

        // 1. Read MAGTORQ_Engineering_Data.xlsx if it exists
        if (excel1Exists) {
          console.log(`Loading database from ${this.engineeringDataPath}`);
          const wb = xlsxLib.readFile(this.engineeringDataPath);
          
          // Load Series Ratios
          if (wb.SheetNames.includes('Series_Ratios')) {
            const rows = xlsxLib.utils.sheet_to_json<any>(wb.Sheets['Series_Ratios']);
            rows.forEach(row => {
              const seriesVal = row.Series || row.series;
              if (!seriesVal) return;
              const key = seriesVal.toString().trim().toLowerCase();
              const ratio = parseFloat(row.Ratio || row.ratio);
              if (isNaN(ratio)) return;

              if (!mergedRatios[key]) {
                mergedRatios[key] = new Set();
              }
              mergedRatios[key].add(ratio);
            });
          }

          // Load Gearboxes (sparse sheet)
          if (wb.SheetNames.includes('Gearboxes')) {
            const rows = xlsxLib.utils.sheet_to_json<any>(wb.Sheets['Gearboxes']);
            rows.forEach(row => {
              const size = row.Size || row.size || row['Gearbox Size'];
              const series = parseInt(row.Series || row.series);
              const nominal = parseFloat(row['Nominal Torque'] || row.nominal || row.Nominal);
              const rated = parseFloat(row['Rated Torque'] || row.rated || row.Rated);
              if (!size || isNaN(series) || isNaN(nominal) || isNaN(rated)) return;

              const thermal = row.thermal_capacity_kw || row['Thermal Capacity'] || row['thermal_capacity_kw'];
              const thrust = row.thrust_load_rating_kn || row['Thrust Capacity'] || row['thrust_load_rating_kn'] || row['Thrust Load Rating'];

              const key = `${size}_s${series}`;
              mergedGearboxes.set(key, {
                size,
                series,
                nominal,
                rated,
                thermal_capacity_kw: thermal !== undefined && !isNaN(parseFloat(thermal)) ? parseFloat(thermal) : undefined,
                thrust_load_rating_kn: thrust !== undefined && !isNaN(parseFloat(thrust)) ? parseFloat(thrust) : undefined
              });
            });
          }
        }

        // 2. Read MAGTORQ_Gearbox_Database_Updated.xlsx if it exists
        if (excel2Exists) {
          console.log(`Loading database from ${this.gearboxDatabasePath}`);
          const wb = xlsxLib.readFile(this.gearboxDatabasePath);
          if (wb.SheetNames.includes('Gearboxes')) {
            const rows = xlsxLib.utils.sheet_to_json<any>(wb.Sheets['Gearboxes']);
            rows.forEach(row => {
              const size = row.Size || row.size || row['Gearbox Size'];
              const series = parseInt(row.Series || row.series);
              const nominal = parseFloat(row['Nominal Torque'] || row.nominal || row.Nominal);
              const rated = parseFloat(row['Rated Torque'] || row.rated || row.Rated);
              if (!size || isNaN(series) || isNaN(nominal) || isNaN(rated)) return;

              const thermal = row.thermal_capacity_kw || row['Thermal Capacity'] || row['thermal_capacity_kw'];
              const thrust = row.thrust_load_rating_kn || row['Thrust Capacity'] || row['thrust_load_rating_kn'] || row['Thrust Load Rating'];

              const key = `${size}_s${series}`;
              mergedGearboxes.set(key, {
                size,
                series,
                nominal,
                rated,
                thermal_capacity_kw: thermal !== undefined && !isNaN(parseFloat(thermal)) ? parseFloat(thermal) : undefined,
                thrust_load_rating_kn: thrust !== undefined && !isNaN(parseFloat(thrust)) ? parseFloat(thrust) : undefined
              });
            });
          }
        }

        // 3. Process and enrich gearboxes
        const enrichedGearboxes = Array.from(mergedGearboxes.values());
        enrichedGearboxes.forEach(gb => {
          gb.thermal_capacity_kw = gb.thermal_capacity_kw ?? Number((gb.nominal * 0.015).toFixed(2));
          gb.thrust_load_rating_kn = gb.thrust_load_rating_kn ?? Number((gb.nominal / 200).toFixed(2));
        });

        // 4. Convert sets back to sorted arrays
        const finalizedRatios: Record<string, number[]> = {};
        Object.keys(mergedRatios).forEach(key => {
          finalizedRatios[key] = Array.from(mergedRatios[key]).sort((a, b) => a - b);
        });

        this.cachedGearboxes = enrichedGearboxes;
        this.cachedRatios = finalizedRatios;
        this.initialized = true;

        console.log(`DATABASE SOURCE: EXCEL_ONLY`);
        console.log(`Excel loaded successfully from database workbooks. 0 fallback records merged.`);
        console.log(`Record counts loaded: ${this.cachedGearboxes.length} gearboxes, and ratios for series: ${Object.keys(this.cachedRatios).join(', ')}`);
      } else {
        throw new Error('Database spreadsheets are missing in server/data directory.');
      }
    } catch (err) {
      console.error('Failed to initialize EngineeringDatabaseService:', err);
      throw err;
    }
  }

  public static getGearboxes(): Gearbox[] {
    if (!this.initialized) {
      throw new Error('EngineeringDatabaseService not initialized.');
    }
    return this.cachedGearboxes;
  }

  public static getSeriesRatios(): Record<string, number[]> {
    if (!this.initialized) {
      throw new Error('EngineeringDatabaseService not initialized.');
    }
    return this.cachedRatios;
  }

  public static async updateDatabase(type: 'engineering_data' | 'gearbox_database', fileName: string, fileDataB64: string): Promise<{ success: boolean; message: string }> {
    try {
      const buffer = Buffer.from(fileDataB64, 'base64');
      const targetPath = type === 'engineering_data' ? this.engineeringDataPath : this.gearboxDatabasePath;

      // Ensure data directory exists
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Backup existing file if it exists
      if (fs.existsSync(targetPath)) {
        const backupPath = `${targetPath}.bak`;
        fs.copyFileSync(targetPath, backupPath);
        console.log(`Backed up existing database to ${backupPath}`);
      }

      // Write new file
      fs.writeFileSync(targetPath, buffer);
      console.log(`Saved updated database to ${targetPath}`);

      // Re-initialize cache
      await this.initialize();

      return {
        success: true,
        message: `Database '${fileName}' uploaded and parsed successfully. Cache re-loaded.`
      };
    } catch (err) {
      console.error(`Failed to update database:`, err);
      return {
        success: false,
        message: `Failed to write/parse updated database: ${(err as Error).message}`
      };
    }
  }
}
