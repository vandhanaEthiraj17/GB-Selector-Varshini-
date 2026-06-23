import { EngineeringDatabaseService as ServerDbService } from '../server/services/EngineeringDatabaseService';
import { EngineeringDatabaseService as ClientDbService } from '../src/services/EngineeringDatabaseService';
import { verifyDatabaseIntegrity } from '../src/services/verificationEngine';

async function test() {
  await ServerDbService.initialize();
  ClientDbService.registerProviders(
    () => ServerDbService.getGearboxes(),
    () => ServerDbService.getSeriesRatios()
  );
  
  console.log("Ratios in ServerDbService:", ServerDbService.getSeriesRatios());
  console.log("Ratios in ClientDbService:", ClientDbService.getSeriesData());
  
  const result = verifyDatabaseIntegrity();
  console.log("Database Integrity Results:", result);
}

test().catch(console.error);
