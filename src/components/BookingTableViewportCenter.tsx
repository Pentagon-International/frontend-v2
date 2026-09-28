import type { ReactNode } from "react";

/**
 * Centers content in the visible booking-list table window.
 * `100cqi` is the scroll area's visible width (`erp-list-table-scroll`),
 * so the loader is centered on first paint instead of the full table width.
 */
export function BookingTableViewportCenter({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "sticky",
        left: 0,
        width: "100cqi",
        maxWidth: "100cqi",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        boxSizing: "border-box",
        padding: "80px 16px",
      }}
    >
      {children}
    </div>
  );
}
