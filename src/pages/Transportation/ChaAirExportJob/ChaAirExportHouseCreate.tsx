import AirExportHouseCreate from "../AirExportJob/AirHouseCreate";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_AIR_EXPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaAirExportHouseCreate() {
  return (
    <ChaJobProvider config={CHA_AIR_EXPORT_CONFIG}>
      <AirExportHouseCreate />
    </ChaJobProvider>
  );
}
