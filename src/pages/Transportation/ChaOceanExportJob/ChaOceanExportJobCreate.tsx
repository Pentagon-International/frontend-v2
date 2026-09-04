import ExportJobCreate from "../ExportJob/ExportJobCreate";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_OCEAN_EXPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaOceanExportJobCreate() {
  return (
    <ChaJobProvider config={CHA_OCEAN_EXPORT_CONFIG}>
      <ExportJobCreate />
    </ChaJobProvider>
  );
}
