import type { ApprovalLinkPosition } from "./utils/matchApprovalLinks";

type PdfApprovalLinkOverlayProps = {
  links: ApprovalLinkPosition[];
  pageNumber: number;
  pageWidth: number;
};

export function PdfApprovalLinkOverlay({
  links,
  pageNumber,
  pageWidth,
}: PdfApprovalLinkOverlayProps) {
  const pageLinks = links.filter((link) => link.pageNumber === pageNumber);
  if (pageLinks.length === 0) return null;

  return (
    <>
      {pageLinks.map((link) => (
        <a
          key={`${link.pageNumber}-${link.label}-${link.rect.left.toFixed(1)}-${link.rect.top.toFixed(1)}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={link.label}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: link.rect.left,
            top: link.rect.top,
            width: Math.max(Math.min(link.rect.width, pageWidth - link.rect.left), 4),
            height: Math.max(link.rect.height, 14),
            zIndex: 20,
            pointerEvents: "auto",
            cursor: "pointer",
            backgroundColor: "transparent",
          }}
        />
      ))}
    </>
  );
}
