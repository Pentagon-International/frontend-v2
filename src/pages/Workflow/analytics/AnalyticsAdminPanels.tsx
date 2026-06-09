import { FC, useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Badge,
  Loader,
  Center,
} from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import toast from "react-hot-toast";
import {
  deleteVannaMemoryEntry,
  listVannaMemory,
  trainVanna,
  type VannaMemoryItem,
  type VannaTrainPayload,
} from "./vannaTrainingApi";
import styles from "./AnalyticsTraining.module.css";

export type AnalyticsAdminView = "chat" | "train" | "memory";

export const AnalyticsTrainPanel: FC = () => {
  const [sqlQuestion, setSqlQuestion] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");
  const [ddlTable, setDdlTable] = useState("");
  const [ddlContent, setDdlContent] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docQuestion, setDocQuestion] = useState("");
  const [trainSubmitting, setTrainSubmitting] = useState(false);

  const postTrain = async (payload: VannaTrainPayload, successMsg: string) => {
    setTrainSubmitting(true);
    try {
      await trainVanna(payload);
      toast.success(successMsg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Training failed";
      toast.error(msg);
    } finally {
      setTrainSubmitting(false);
    }
  };

  return (
    <Box className={styles.embeddedPanel}>
      <Stack gap="lg" p="md" maw={800} mx="auto" w="100%">
        <Paper withBorder p="md" radius="md">
          <Text fw={600} mb="xs">
            SQL example
          </Text>
          <Text fz="sm" c="dimmed" mb="md">
            Teach question → SQL mappings (type: sql_example).
          </Text>
          <Stack gap="sm">
            <TextInput
              label="Question"
              placeholder="How many enquiries were created last month?"
              value={sqlQuestion}
              onChange={(e) => setSqlQuestion(e.currentTarget.value)}
            />
            <Textarea
              label="SQL"
              placeholder="SELECT COUNT(*) FROM ..."
              minRows={4}
              className={styles.monoInput}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.currentTarget.value)}
            />
            <Button
              loading={trainSubmitting}
              onClick={() => {
                if (!sqlQuestion.trim() || !sqlQuery.trim()) {
                  toast.error("Question and SQL are required.");
                  return;
                }
                void postTrain(
                  { type: "sql_example", question: sqlQuestion.trim(), sql: sqlQuery.trim() },
                  "SQL example saved.",
                );
                setSqlQuestion("");
                setSqlQuery("");
              }}
            >
              Save SQL example
            </Button>
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Text fw={600} mb="xs">
            DDL / schema
          </Text>
          <Stack gap="sm">
            <TextInput
              label="Table name"
              value={ddlTable}
              onChange={(e) => setDdlTable(e.currentTarget.value)}
            />
            <Textarea
              label="DDL content"
              minRows={5}
              className={styles.monoInput}
              value={ddlContent}
              onChange={(e) => setDdlContent(e.currentTarget.value)}
            />
            <Button
              loading={trainSubmitting}
              onClick={() => {
                if (!ddlContent.trim()) {
                  toast.error("DDL content is required.");
                  return;
                }
                void postTrain(
                  {
                    type: "ddl",
                    table: ddlTable.trim() || "unknown",
                    content: ddlContent.trim(),
                  },
                  "Schema saved.",
                );
                setDdlTable("");
                setDdlContent("");
              }}
            >
              Save DDL
            </Button>
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius="md">
          <Text fw={600} mb="xs">
            Documentation
          </Text>
          <Stack gap="sm">
            <TextInput
              label="Title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.currentTarget.value)}
            />
            <Textarea
              label="Content"
              minRows={4}
              value={docContent}
              onChange={(e) => setDocContent(e.currentTarget.value)}
            />
            <TextInput
              label="Related question (optional)"
              value={docQuestion}
              onChange={(e) => setDocQuestion(e.currentTarget.value)}
            />
            <Button
              loading={trainSubmitting}
              onClick={() => {
                if (!docContent.trim()) {
                  toast.error("Content is required.");
                  return;
                }
                void postTrain(
                  {
                    type: "documentation",
                    title: docTitle.trim() || "Untitled",
                    content: docContent.trim(),
                    question: docQuestion.trim() || undefined,
                  },
                  "Documentation saved.",
                );
                setDocTitle("");
                setDocContent("");
                setDocQuestion("");
              }}
            >
              Save documentation
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
};

const MemoryCard: FC<{ item: VannaMemoryItem; onDelete: () => void }> = ({
  item,
  onDelete,
}) => {
  const type = item.metadata?.type ?? "entry";
  const subtitle =
    item.metadata?.question?.slice(0, 50) ||
    item.metadata?.table ||
    item.metadata?.title ||
    "";
  const preview = (item.document ?? "").slice(0, 200);

  return (
    <Paper withBorder p="sm" radius="md" className={styles.memoryCard}>
      <Group justify="space-between" mb={6}>
        <Badge size="xs" variant="light">
          {type.replace("_", " ")}
        </Badge>
        <Text fz="xs" c="dimmed" truncate maw={200}>
          {subtitle}
        </Text>
      </Group>
      <Text fz="xs" className={styles.memoryPreview}>
        {preview}
        {(item.document?.length ?? 0) > 200 ? "…" : ""}
      </Text>
      <Group justify="space-between" mt="xs">
        <Text fz="xs" c="dimmed" ff="monospace">
          {item.id}
        </Text>
        <Button size="compact-xs" variant="subtle" color="red" onClick={onDelete}>
          Delete
        </Button>
      </Group>
    </Paper>
  );
};

export const AnalyticsMemoryPanel: FC = () => {
  const [memoryItems, setMemoryItems] = useState<VannaMemoryItem[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryTotal, setMemoryTotal] = useState(0);

  const loadMemory = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const data = await listVannaMemory(200);
      setMemoryItems(data.items ?? []);
      setMemoryTotal(data.total ?? data.items?.length ?? 0);
    } catch {
      toast.error("Could not load training memory.");
      setMemoryItems([]);
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  return (
    <Box className={styles.embeddedPanel}>
      <Box p="md" maw={800} mx="auto" w="100%">
        <Group justify="space-between" mb="md">
          <Text fw={600}>vanna_memory ({memoryTotal} entries)</Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={() => void loadMemory()}
            loading={memoryLoading}
          >
            Refresh
          </Button>
        </Group>
        {memoryLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : memoryItems.length === 0 ? (
          <Text c="dimmed" fz="sm">
            No entries yet. Add training data in the Train tab.
          </Text>
        ) : (
          <Stack gap="sm">
            {memoryItems.map((item) => (
              <MemoryCard
                key={item.id}
                item={item}
                onDelete={async () => {
                  try {
                    await deleteVannaMemoryEntry(item.id);
                    toast.success("Entry deleted.");
                    void loadMemory();
                  } catch {
                    toast.error("Could not delete entry.");
                  }
                }}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
};
