import { FC } from "react";

export const FilePreviewFrame: FC<{ url: string; title?: string }> = ({ url, title = "File preview" }) => (
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
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ marginTop: 10, fontSize: ".72rem", color: "var(--accent)" }}
    >
      Open in new tab
    </a>
  </div>
);
