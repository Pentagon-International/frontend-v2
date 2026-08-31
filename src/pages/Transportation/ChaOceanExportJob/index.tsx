import ExportJobMaster from "../ExportJob";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_OCEAN_EXPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaOceanExportJobMaster() {
  return (
    <ChaJobProvider config={CHA_OCEAN_EXPORT_CONFIG}>
      <ExportJobMaster />
    </ChaJobProvider>
  );
}
