import { URL } from "../../api/serverUrls";
import OceanDsrBase from "./OceanDsrBase";

export default function OceanImportDsr() {
  return <OceanDsrBase title="Ocean Import DSR" listEndpoint={URL.oceanImportBooked} />;
}
