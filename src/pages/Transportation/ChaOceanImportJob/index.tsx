import ImportJobMaster from "../ImportJob";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_OCEAN_IMPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaOceanImportJobMaster() {
  return (
    <ChaJobProvider config={CHA_OCEAN_IMPORT_CONFIG}>
      <ImportJobMaster />
    </ChaJobProvider>
  );
}
