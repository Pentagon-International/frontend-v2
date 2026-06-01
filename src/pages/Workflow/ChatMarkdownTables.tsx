import { FC, ReactNode } from "react";
import type { Components } from "react-markdown";
import styles from "./Chatbot.module.css";

type HastText = { type: "text"; value: string };
type HastElement = {
  type: "element";
  tagName: string;
  children: HastNode[];
};
type HastNode = HastText | HastElement | { type: string; children?: HastNode[] };

export type TableMatrix = string[][];

const textFromHast = (node: HastNode): string => {
  if (node.type === "text") return (node as HastText).value;
  if (node.type === "element") {
    return (node as HastElement).children.map(textFromHast).join("").trim();
  }
  return "";
};

const matrixFromTableNode = (node: HastElement | undefined): TableMatrix | null => {
  if (!node || node.tagName !== "table") return null;

  const rows: string[][] = [];
  for (const section of node.children) {
    if (section.type !== "element") continue;
    const el = section as HastElement;
    if (el.tagName !== "thead" && el.tagName !== "tbody") continue;

    for (const rowNode of el.children) {
      if (rowNode.type !== "element") continue;
      const tr = rowNode as HastElement;
      if (tr.tagName !== "tr") continue;

      const cells = tr.children
        .filter(
          (c): c is HastElement =>
            c.type === "element" && (c.tagName === "th" || c.tagName === "td"),
        )
        .map((cell) => textFromHast(cell));

      if (cells.length > 0) rows.push(cells);
    }
  }

  return rows.length > 0 ? rows : null;
};

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");

export const isKpiSummaryTable = (matrix: TableMatrix): boolean => {
  if (matrix.length < 2) return false;

  const [header, ...dataRows] = matrix;
  if (header.length !== 2 || dataRows.length === 0 || dataRows.length > 10) return false;

  const h0 = normalizeHeader(header[0] ?? "");
  const h1 = normalizeHeader(header[1] ?? "");
  const isMetricCount = h0 === "metric" && h1 === "count";
  const isLabelValue = h0 === "label" && h1 === "value";
  if (!isMetricCount && !isLabelValue) return false;

  return dataRows.every((row) => row.length === 2);
};

type ChatKpiCardsProps = { rows: { label: string; value: string }[] };

export const ChatKpiCards: FC<ChatKpiCardsProps> = ({ rows }) => (
  <div className={styles.kpiGrid} role="list">
    {rows.map((row, index) => (
      <div
        key={`${row.label}-${row.value}-${index}`}
        className={styles.kpiCard}
        role="listitem"
      >
        <div className={styles.kpiLabel}>{row.label}</div>
        <div className={styles.kpiValue}>{row.value}</div>
      </div>
    ))}
  </div>
);

const ChatTable: FC<{ children: ReactNode }> = ({ children }) => (
  <div className={styles.tableScroll}>
    <table className={styles.chatTable}>{children}</table>
  </div>
);

const ChatTableHeader: FC<{ children: ReactNode }> = ({ children }) => (
  <thead className={styles.chatTableHead}>{children}</thead>
);

const ChatTableRow: FC<{ children: ReactNode }> = ({ children }) => (
  <tr className={styles.chatTableRow}>{children}</tr>
);

export const chatMarkdownTableComponents: Partial<Components> = {
  table: ({ node, children }) => {
    const tableNode =
      node?.type === "element" ? (node as unknown as HastElement) : undefined;
    const matrix = matrixFromTableNode(tableNode);

    if (matrix && isKpiSummaryTable(matrix)) {
      const [, ...dataRows] = matrix;
      const cards = dataRows.map(([label, value]) => ({ label, value }));
      return <ChatKpiCards rows={cards} />;
    }

    return <ChatTable>{children}</ChatTable>;
  },
  thead: ({ children }) => <ChatTableHeader>{children}</ChatTableHeader>,
  tr: ({ children }) => <ChatTableRow>{children}</ChatTableRow>,
  th: ({ children }) => <th className={styles.chatTableCell}>{children}</th>,
  td: ({ children }) => <td className={styles.chatTableCell}>{children}</td>,
};
