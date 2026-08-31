import ImportJobCreate from "../ImportJob/ImportJobCreate";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_OCEAN_IMPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaOceanImportJobCreate() {
  return (
    <ChaJobProvider config={CHA_OCEAN_IMPORT_CONFIG}>
      <ImportJobCreate />
    </ChaJobProvider>
  );
}
