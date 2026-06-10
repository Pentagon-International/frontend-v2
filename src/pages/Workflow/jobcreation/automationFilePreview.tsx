import { FC, useCallback, useState, type CSSProperties, type MouseEvent } from "react";

export const isViewableFileUrl = (url?: string | null): url is string =>
  Boolean(url?.trim()) && !url!.trim().startsWith("temp_uploads");

const sanitizeDownloadFilename = (filename: string, fallback = "download.pdf"): string => {
  const name = filename?.trim() || fallback;
  return name.replace(/[<>:"/\\|?*]+/g, "_");
};

const resolveDownloadFilename = (url: string, filename?: string): string => {
  if (filename?.trim()) return sanitizeDownloadFilename(filename);
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const fromUrl = pathname.split("/").pop();
    if (fromUrl) return sanitizeDownloadFilename(decodeURIComponent(fromUrl));
  } catch {
    // ignore malformed URLs
  }
  return "download.pdf";
};

export const downloadAutomationFile = async (url: string, filename?: string): Promise<void> => {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = resolveDownloadFilename(url, filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 200);
};

const DownloadFileButton: FC<{
  url: string;
  filename?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
}> = ({ url, filename, className, style, label = "↓ Download" }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadAutomationFile(url, filename);
    } catch {
      // Keep silent — no new tab or inline preview on failure
    } finally {
      setDownloading(false);
    }
  }, [downloading, filename, url]);

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={handleDownload}
      disabled={downloading}
    >
      {downloading ? "Downloading…" : label}
    </button>
  );
};

export const FilePreviewFrame: FC<{ url: string; title?: string; filename?: string }> = ({
  url,
  title = "File preview",
  filename,
}) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: 16,
    }}
  >
    <iframe
      src={url}
      title={title}
      style={{
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: "calc(88vh - 220px)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "#fff",
      }}
    />
    <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <DownloadFileButton
        url={url}
        filename={filename}
        style={{
          fontSize: ".72rem",
          color: "var(--accent)",
          fontWeight: 600,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: ".72rem", color: "var(--muted)" }}
      >
        Open in new tab
      </a>
    </div>
  </div>
);

interface FilePreviewModalProps {
  url: string;
  filename?: string;
  title?: string;
  onClose: () => void;
  onBack?: () => void;
}

export const FilePreviewModal: FC<FilePreviewModalProps> = ({
  url,
  filename,
  title,
  onClose,
  onBack,
}) => (
  <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal modal-xl" style={{ display: "flex", flexDirection: "column" }}>
      <div className="modal-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title ?? filename ?? "File Preview"}
          </h2>
          {filename && title && filename !== title && (
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 4, fontFamily: "var(--mono)" }}>
              {filename}
            </div>
          )}
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <FilePreviewFrame url={url} title={title ?? filename} filename={filename} />
      <div className="modal-foot">
        {onBack && (
          <button className="btn btn-ghost" onClick={onBack}>← Back to files</button>
        )}
        <DownloadFileButton
          url={url}
          filename={filename}
          className="btn btn-primary"
          label="↓ Download"
        />
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
);
