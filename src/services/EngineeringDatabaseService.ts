import * as XLSX from 'xlsx';
const xlsxLib: any = typeof XLSX.readFile !== 'undefined' ? XLSX : (XLSX as any).default;
import { Gearbox } from '../types/Gearbox';

export class EngineeringDatabaseService {
  private static cachedGearboxes: Gearbox[] = [];
  private static cachedRatios: Record<string, number[]> = {};
  private static initialized = false;

  // Dynamic provider registration for backend integration
  private static gearboxProvider: (() => Gearbox[]) | null = null;
  private static ratiosProvider: (() => Record<string, number[]>) | null = null;

  public static registerProviders(
    gbProvider: () => Gearbox[],
    ratioProvider: () => Record<string, number[]>
  ): void {
    this.gearboxProvider = gbProvider;
    this.ratiosProvider = ratioProvider;
    this.initialized = true;
  }

  public static async init(force = false): Promise<void> {
    if (this.initialized && !force) return;
    this.initialized = false;

    if (typeof window === 'undefined') {
      await this.initAsyncForNode();
      return;
    }

    // Client-side initialization is disabled to prevent database downloads in the browser.
    console.log('EngineeringDatabaseService: Client-side catalog cache is disabled for safety.');
    this.cachedGearboxes = [];
    this.cachedRatios = {};
    this.initialized = true;
  }

  public static getGearboxDatabase(): Gearbox[] {
    if (this.gearboxProvider) {
      return this.gearboxProvider();
    }
    this.ensureInitialized();
    return this.cachedGearboxes;
  }

  public static getSeriesData(): Record<string, number[]> {
    if (this.ratiosProvider) {
      return this.ratiosProvider();
    }
    this.ensureInitialized();
    return this.cachedRatios;
  }

  private static ensureInitialized() {
    if (this.initialized) return;

    if (typeof window === 'undefined') {
      this.initSyncForNode();
    } else {
      console.warn("EngineeringDatabaseService accessed in browser! Return empty catalog.");
      this.cachedGearboxes = [];
      this.cachedRatios = {};
      this.initialized = true;
    }
  }

  private static async initAsyncForNode() {
    try {
      const fsName = 'fs';
      const pathName = 'path';
      const fs: any = await import(/* @vite-ignore */ fsName);
      const path: any = await import(/* @vite-ignore */ pathName);

      const projectRoot = (globalThis as any).process?.cwd?.() || '';
      const file1 = path.join(projectRoot, 'server/data/MAGTORQ_Engineering_Data.xlsx');
      const file2 = path.join(projectRoot, 'server/data/MAGTORQ_Gearbox_Database_Updated.xlsx');

      const excel1Exists = fs.existsSync(file1);
      const excel2Exists = fs.existsSync(file2);

      if (excel1Exists || excel2Exists) {
        const mergedGearboxes: Map<string, Gearbox> = new Map();
        const mergedRatios: Record<string, Set<number>> = {};

        if (excel1Exists) {
          const wb = xlsxLib.read(fs.readFileSync(file1));
          if (wb.SheetNames.includes('Series_Ratios')) {
            const rows = (xlsxLib.utils.sheet_to_json as any)(wb.Sheets['Series_Ratios']);
            rows.forEach((row: any) => {
              const seriesVal = row.Series || row.series;
              if (!seriesVal) return;
              const key = seriesVal.toString().trim().toLowerCase();
              const ratio = parseFloat(row.Ratio || row.ratio);
              if (isNaN(ratio)) return;
              if (!mergedRatios[key]) mergedRatios[key] = new Set();
              mergedRatios[key].add(ratio);
            });
          }

          if (wb.SheetNames.includes('Gearboxes')) {
            const rows = (xlsxLib.utils.sheet_to_json as any)(wb.Sheets['Gearboxes']);
            rows.forEach((row: any) => {
              const size = row.Size || row.size;
              const series = parseInt(row.Series || row.series);
              const nominal = parseFloat(row['Nominal Torque'] || row.nominal);
              const rated = parseFloat(row['Rated Torque'] || row.rated);
              if (!size || isNaN(series) || isNaN(nominal) || isNaN(rated)) return;
              mergedGearboxes.set(`${size}_s${series}`, { size, series, nominal, rated });
            });
          }
        }

        if (excel2Exists) {
          const wb = xlsxLib.read(fs.readFileSync(file2));
          if (wb.SheetNames.includes('Gearboxes')) {
            const rows = (xlsxLib.utils.sheet_to_json as any)(wb.Sheets['Gearboxes']);
            rows.forEach((row: any) => {
              const size = row.Size || row.size;
              const series = parseInt(row.Series || row.series);
              const nominal = parseFloat(row['Nominal Torque'] || row.nominal);
              const rated = parseFloat(row['Rated Torque'] || row.rated);
              if (!size || isNaN(series) || isNaN(nominal) || isNaN(rated)) return;
              mergedGearboxes.set(`${size}_s${series}`, { size, series, nominal, rated });
            });
          }
        }

        const enriched = Array.from(mergedGearboxes.values());
        enriched.forEach(gb => {
          gb.thermal_capacity_kw = gb.thermal_capacity_kw ?? Number((gb.nominal * 0.015).toFixed(2));
          gb.thrust_load_rating_kn = gb.thrust_load_rating_kn ?? Number((gb.nominal / 200).toFixed(2));
        });

        const finalizedRatios: Record<string, number[]> = {};
        Object.keys(mergedRatios).forEach(key => {
          finalizedRatios[key] = Array.from(mergedRatios[key]).sort((a, b) => a - b);
        });

        this.cachedGearboxes = enriched;
        this.cachedRatios = finalizedRatios;
        this.initialized = true;

        console.log(`DATABASE SOURCE: EXCEL_ONLY`);
      } else {
        throw new Error('Database spreadsheets missing in server/data directory.');
      }
    } catch (err) {
      console.error('Failed to parse Excel files asynchronously in Node:', err);
      throw err;
    }
  }

  private static initSyncForNode() {
    try {
      if (typeof (globalThis as any).require === 'undefined') {
        this.cachedGearboxes = [];
        this.cachedRatios = {};
        this.initialized = true;
        return;
      }

      // Avoid bundler issues in browser by hiding Node modules in eval
      const fs = eval("require('fs')");
      const path = eval("require('path')");

      const projectRoot = (globalThis as any).process?.cwd?.() || '';
      const file1 = path.join(projectRoot, 'server/data/MAGTORQ_Engineering_Data.xlsx');
      const file2 = path.join(projectRoot, 'server/data/MAGTORQ_Gearbox_Database_Updated.xlsx');

      const excel1Exists = fs.existsSync(file1);
      const excel2Exists = fs.existsSync(file2);

      if (excel1Exists || excel2Exists) {
        const mergedGearboxes: Map<string, Gearbox> = new Map();
        const mergedRatios: Record<string, Set<number>> = {};

        if (excel1Exists) {
          const wb = xlsxLib.readFile(file1);
          if (wb.SheetNames.includes('Series_Ratios')) {
            const rows = (xlsxLib.utils.sheet_to_json as any)(wb.Sheets['Series_Ratios']);
            rows.forEach((row: any) => {
              const seriesVal = row.Series || row.series;
              if (!seriesVal) return;
              const key = seriesVal.toString().trim().toLowerCase();
              const ratio = parseFloat(row.Ratio || row.ratio);
              if (isNaN(ratio)) return;
              if (!mergedRatios[key]) mergedRatios[key] = new Set();
              mergedRatios[key].add(ratio);
            });
          }

          if (wb.SheetNames.includes('Gearboxes')) {
            const rows = (xlsxLib.utils.sheet_to_json as any)(wb.Sheets['Gearboxes']);
            rows.forEach((row: any) => {
              const size = row.Size || row.size;
              const series = parseInt(row.Series || row.series);
              const nominal = parseFloat(row['Nominal Torque'] || row.nominal);
              const rated = parseFloat(row['Rated Torque'] || row.rated);
              if (!size || isNaN(series) || isNaN(nominal) || isNaN(rated)) return;
              mergedGearboxes.set(`${size}_s${series}`, { size, series, nominal, rated });
            });
          }
        }

        if (excel2Exists) {
          const wb = xlsxLib.readFile(file2);
          if (wb.SheetNames.includes('Gearboxes')) {
            const rows = (xlsxLib.utils.sheet_to_json as any)(wb.Sheets['Gearboxes']);
            rows.forEach((row: any) => {
              const size = row.Size || row.size;
              const series = parseInt(row.Series || row.series);
              const nominal = parseFloat(row['Nominal Torque'] || row.nominal);
              const rated = parseFloat(row['Rated Torque'] || row.rated);
              if (!size || isNaN(series) || isNaN(nominal) || isNaN(rated)) return;
              mergedGearboxes.set(`${size}_s${series}`, { size, series, nominal, rated });
            });
          }
        }

        const enriched = Array.from(mergedGearboxes.values());
        enriched.forEach(gb => {
          gb.thermal_capacity_kw = gb.thermal_capacity_kw ?? Number((gb.nominal * 0.015).toFixed(2));
          gb.thrust_load_rating_kn = gb.thrust_load_rating_kn ?? Number((gb.nominal / 200).toFixed(2));
        });

        const finalizedRatios: Record<string, number[]> = {};
        Object.keys(mergedRatios).forEach(key => {
          finalizedRatios[key] = Array.from(mergedRatios[key]).sort((a, b) => a - b);
        });

        this.cachedGearboxes = enriched;
        this.cachedRatios = finalizedRatios;
        this.initialized = true;

        console.log(`DATABASE SOURCE: EXCEL_ONLY`);
      } else {
        throw new Error('Database spreadsheets missing in server/data directory.');
      }
    } catch (err) {
      console.error('Failed to parse Excel files synchronously in Node:', err);
      throw err;
    }
  }
}
