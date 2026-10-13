import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Centers content in the visible list-table window.
 * Width comes from the scroll box (`data-erp-list-table-scroll`), not a
 * container query. A container query on that scroll box breaks sticky headers.
 */
export function BookingTableViewportCenter({
  children,
}: {
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();

  useEffect(() => {
    const scroll = ref.current?.closest("[data-erp-list-table-scroll]");
    if (!(scroll instanceof HTMLElement)) return;

    const update = () => setWidth(scroll.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "sticky",
        left: 0,
        width: width ? `${width}px` : "100%",
        maxWidth: width ? `${width}px` : "100%",
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
