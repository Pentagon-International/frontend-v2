import AirImportJobMaster from "../AirImportJob";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_AIR_IMPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaAirImportJobMaster() {
  return (
    <ChaJobProvider config={CHA_AIR_IMPORT_CONFIG}>
      <AirImportJobMaster />
    </ChaJobProvider>
  );
}
