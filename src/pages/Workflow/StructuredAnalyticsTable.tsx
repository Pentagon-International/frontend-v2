import { FC } from "react";
import type { AnalyticsChatTable } from "./analyticsChatTypes";
import { ChatKpiCards, isKpiSummaryTable, type TableMatrix } from "./ChatMarkdownTables";
import styles from "./Chatbot.module.css";

const formatCell = (value: unknown): string => {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const tableToMatrix = (table: AnalyticsChatTable): TableMatrix => {
  const { columns, rows } = table;
  const header = columns.map((c) => String(c));
  const dataRows = rows.map((row) => columns.map((col) => formatCell(row[col])));
  return [header, ...dataRows];
};

export const StructuredAnalyticsTable: FC<{ table: AnalyticsChatTable }> = ({ table }) => {
  const { columns, rows, title, description, total_rows, truncated } = table;
  if (!columns?.length || !rows?.length) return null;

  const matrix = tableToMatrix(table);

  if (isKpiSummaryTable(matrix)) {
    const [, ...dataRows] = matrix;
    const cards = dataRows.map(([label, value]) => ({ label, value }));
    return (
      <div className={styles.analyticsBlock}>
        {title ? <TextBlock title={title} description={description} /> : null}
        <ChatKpiCards rows={cards} />
        {truncated && total_rows > rows.length ? (
          <p className={styles.analyticsMeta}>
            Showing {rows.length} of {total_rows} rows
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.analyticsBlock}>
      {title ? <TextBlock title={title} description={description} /> : null}
      <div className={styles.tableScroll}>
        <table className={styles.chatTable}>
          <thead className={styles.chatTableHead}>
            <tr className={styles.chatTableRow}>
              {columns.map((col) => (
                <th key={col} className={styles.chatTableCell}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className={styles.chatTableRow}>
                {columns.map((col) => (
                  <td key={`${rowIndex}-${col}`} className={styles.chatTableCell}>
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && total_rows > rows.length ? (
        <p className={styles.analyticsMeta}>
          Showing {rows.length} of {total_rows} rows
        </p>
      ) : null}
    </div>
  );
};

const TextBlock: FC<{ title: string; description?: string }> = ({ title, description }) => (
  <div className={styles.analyticsTableHeading}>
    <div className={styles.analyticsTableTitle}>{title}</div>
    {description ? <div className={styles.analyticsTableDescription}>{description}</div> : null}
  </div>
);
