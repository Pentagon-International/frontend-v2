import toast from "react-hot-toast";
import { chatApi } from "./chatApi";
import type { AnalyticsChatExport } from "./analyticsChatTypes";

export const downloadAnalyticsExport = async (exportInfo: AnalyticsChatExport): Promise<void> => {
  const path = exportInfo.download_url;

  try {
    const res = await chatApi.get(path, { responseType: "blob" });
    const blob = res.data as Blob;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = exportInfo.filename || "export.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    toast.error("Could not download CSV. Please try again.");
  }
};
