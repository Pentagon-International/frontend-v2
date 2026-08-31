import AirExportJobCreate from "../AirExportJob/AirExportJobCreate";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_AIR_EXPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaAirExportJobCreate() {
  return (
    <ChaJobProvider config={CHA_AIR_EXPORT_CONFIG}>
      <AirExportJobCreate />
    </ChaJobProvider>
  );
}
