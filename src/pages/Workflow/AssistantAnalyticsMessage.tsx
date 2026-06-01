import { FC, useState } from "react";
import { Button, Text } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import type { AnalyticsMessagePayload } from "./analyticsChatTypes";
import type { ChatReferences } from "./chatbotMessageUtils";
import type { ReferenceLinkTarget } from "./chatReferenceNavigation";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { StructuredAnalyticsTable } from "./StructuredAnalyticsTable";
import { AnalyticsChatChartBlock } from "./AnalyticsChatChart";
import { downloadAnalyticsExport } from "./analyticsExport";
import styles from "./Chatbot.module.css";

export const AssistantAnalyticsMessage: FC<{
  content: string;
  analytics: AnalyticsMessagePayload;
  references?: ChatReferences;
  onReferenceLinkClick?: (
    target: ReferenceLinkTarget,
    refs: ChatReferences,
  ) => void;
}> = ({ content, analytics, references, onReferenceLinkClick }) => {
  const [exporting, setExporting] = useState(false);

  const hasReply = Boolean(content?.trim());
  const hasTable = Boolean(analytics.table?.rows?.length);
  const hasChart = Boolean(analytics.chart?.data);
  const hasExport = Boolean(analytics.export?.download_url);

  const handleExport = async () => {
    if (!analytics.export) return;
    setExporting(true);
    try {
      await downloadAnalyticsExport(analytics.export);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.analyticsMessage}>
      {analytics.summary?.trim() ? (
        <Text className={styles.analyticsSummary} size="sm" component="p">
          {analytics.summary.trim()}
        </Text>
      ) : null}

      {hasReply ? (
        <AssistantMarkdown
          content={content}
          references={references}
          onReferenceLinkClick={onReferenceLinkClick}
        />
      ) : null}

      {hasTable && analytics.table ? (
        <StructuredAnalyticsTable table={analytics.table} />
      ) : null}

      {analytics.chart_requested && !hasChart ? (
        <Text className={styles.analyticsMeta} size="xs" component="p">
          Chart could not be generated for this query.
        </Text>
      ) : null}

      {hasChart && analytics.chart ? (
        <AnalyticsChatChartBlock chart={analytics.chart} />
      ) : null}

      {hasExport && analytics.export ? (
        <div className={styles.analyticsActions}>
          <Button
            size="xs"
            variant="light"
            color="blue"
            leftSection={<IconDownload size={14} />}
            loading={exporting}
            onClick={() => void handleExport()}
          >
            Download CSV ({analytics.export.total_rows} rows)
          </Button>
        </div>
      ) : null}
    </div>
  );
};
