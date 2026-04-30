import { URL } from "../../api/serverUrls";
import OceanDsrBase from "./OceanDsrBase";

export default function OceanExportDsr() {
  return <OceanDsrBase title="Ocean Export DSR" listEndpoint={URL.oceanImportBooked} />;
}
