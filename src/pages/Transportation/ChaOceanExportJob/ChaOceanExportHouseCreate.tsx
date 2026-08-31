import ExportHouseCreate from "../ExportJob/HouseCreate";
import { ChaJobProvider } from "../chaJob/chaJobContext";
import { CHA_OCEAN_EXPORT_CONFIG } from "../chaJob/chaJobConfig";

export default function ChaOceanExportHouseCreate() {
  return (
    <ChaJobProvider config={CHA_OCEAN_EXPORT_CONFIG}>
      <ExportHouseCreate />
    </ChaJobProvider>
  );
}
