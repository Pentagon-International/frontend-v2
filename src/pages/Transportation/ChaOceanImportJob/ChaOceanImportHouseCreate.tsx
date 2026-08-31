import HouseCreate from "../ImportJob/HouseCreate";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_OCEAN_IMPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaOceanImportHouseCreate() {
  return (
    <ChaJobProvider config={CHA_OCEAN_IMPORT_CONFIG}>
      <HouseCreate />
    </ChaJobProvider>
  );
}
