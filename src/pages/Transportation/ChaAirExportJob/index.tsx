import AirExportJobMaster from "../AirExportJob";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_AIR_EXPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaAirExportJobMaster() {
  return (
    <ChaJobProvider config={CHA_AIR_EXPORT_CONFIG}>
      <AirExportJobMaster />
    </ChaJobProvider>
  );
}
