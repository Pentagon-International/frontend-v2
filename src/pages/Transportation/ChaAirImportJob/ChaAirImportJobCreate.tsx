import AirImportJobCreate from "../AirImportJob/AirImportJobCreate";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_AIR_IMPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaAirImportJobCreate() {
  return (
    <ChaJobProvider config={CHA_AIR_IMPORT_CONFIG}>
      <AirImportJobCreate />
    </ChaJobProvider>
  );
}
