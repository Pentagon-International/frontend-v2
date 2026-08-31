import AirHouseCreate from "../AirImportJob/AirHouseCreate";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_AIR_IMPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaAirImportHouseCreate() {
  return (
    <ChaJobProvider config={CHA_AIR_IMPORT_CONFIG}>
      <AirHouseCreate />
    </ChaJobProvider>
  );
}
