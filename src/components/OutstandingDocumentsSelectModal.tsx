import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button, Group, Modal, Table, Text } from "@mantine/core";
import ToastNotification from "./ToastNotification";
import SelectDocumentModalToolbar from "./SelectDocumentModalToolbar";
import SelectDocumentModalLayout, {
  selectDocumentModalStyles,
} from "./SelectDocumentModalLayout";
import { useSelectDocumentModalList } from "../hooks/useSelectDocumentModalList";
import {
  extractTokensFromDocumentSelectionFile,
  findModalDocumentIndicesBySearch,
  findModalDocumentIndicesByTokens,
  mergeSelectedIndices,
  type SelectableModalDocument,
} from "../utils/selectDocumentModalSearch";

type OutstandingDocumentsSelectModalProps<T extends SelectableModalDocument> = {
  opened: boolean;
  onClose: () => void;
  loading?: boolean;
  documents: T[];
  includeInvCrn: boolean;
  searchPlaceholder: string;
  emptyListMessage: string;
  loadingMessage?: string;
  size?: string | number;
  /** Overlay shown above modal body (e.g. opening source document). */
  overlay?: ReactNode;
  tableHeader: ReactNode;
  renderCells: (inv: T, idx: number) => ReactNode;
  /** Restore checkboxes for docs already on Adjustments. */
  getInitialSelectedIndices: (list: T[]) => Set<number>;
  onApply: (selectedIndices: number[], list: T[]) => void;
};

type DocumentsTableProps<T extends SelectableModalDocument> = {
  visibleRows: { inv: T; idx: number }[];
  selectedRef: MutableRefObject<Set<number>>;
  onCountChange: (count: number) => void;
  tableTick: number;
  tableHeader: ReactNode;
  renderCells: (inv: T, idx: number) => ReactNode;
};

/**
 * Table body is memoized and keeps checkboxes uncontrolled so toggling one
 * row does not re-render the table (only the footer count updates).
 */
const DocumentsTable = memo(function DocumentsTableInner({
  visibleRows,
  selectedRef,
  onCountChange,
  tableTick,
  tableHeader,
  renderCells,
}: DocumentsTableProps<SelectableModalDocument>) {
  const toggle = useCallback(
    (idx: number) => {
      const set = selectedRef.current;
      if (set.has(idx)) set.delete(idx);
      else set.add(idx);
      onCountChange(set.size);
    },
    [selectedRef, onCountChange],
  );

  return (
    <Table
      key={tableTick}
      withTableBorder
      withColumnBorders
      striped
      highlightOnHover
      style={{ fontSize: "13px" }}
    >
      <Table.Thead>{tableHeader}</Table.Thead>
      <Table.Tbody>
        {visibleRows.map(({ inv, idx }) => (
          <Table.Tr key={idx}>
            <Table.Td style={{ width: 40 }}>
              <input
                type="checkbox"
                defaultChecked={selectedRef.current.has(idx)}
                onChange={() => toggle(idx)}
                aria-label={`Select document ${idx + 1}`}
                style={{
                  width: 16,
                  height: 16,
                  cursor: "pointer",
                  accentColor: "#105476",
                }}
              />
            </Table.Td>
            {renderCells(inv, idx)}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}) as (props: DocumentsTableProps<SelectableModalDocument>) => ReactElement;

/**
 * Select Document modal with local selection state so checkbox toggles do not
 * re-render the parent payment/receipt page (which is what made select feel slow).
 */
export default function OutstandingDocumentsSelectModal<
  T extends SelectableModalDocument,
>({
  opened,
  onClose,
  loading = false,
  documents,
  includeInvCrn,
  searchPlaceholder,
  emptyListMessage,
  loadingMessage = "Loading documents...",
  size = "lg",
  overlay,
  tableHeader,
  renderCells,
  getInitialSelectedIndices,
  onApply,
}: OutstandingDocumentsSelectModalProps<T>) {
  const selectedRef = useRef<Set<number>>(new Set());
  const [selectedCount, setSelectedCount] = useState(0);
  /** Bump to remount uncontrolled checkboxes after bulk select / restore. */
  const [tableTick, setTableTick] = useState(0);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectingFromFile, setSelectingFromFile] = useState(false);

  const getInitialSelectedIndicesRef = useRef(getInitialSelectedIndices);
  getInitialSelectedIndicesRef.current = getInitialSelectedIndices;

  // Reset/restore selection whenever the modal opens or the document list loads.
  useEffect(() => {
    if (!opened) return;
    setSearch("");
    setFile(null);
    if (loading) {
      selectedRef.current = new Set();
      setSelectedCount(0);
      setTableTick((t) => t + 1);
      return;
    }
    const initial = getInitialSelectedIndicesRef.current(documents);
    selectedRef.current = initial;
    setSelectedCount(initial.size);
    setTableTick((t) => t + 1);
  }, [opened, loading, documents]);

  const { visibleRows, noSearchMatches, searchOpts } = useSelectDocumentModalList(
    documents,
    search,
    includeInvCrn,
  );

  const handleSelectDocumentsFromSearchOrFile = useCallback(async () => {
    try {
      if (file) {
        setSelectingFromFile(true);
        const tokens = await extractTokensFromDocumentSelectionFile(file);
        const matched = findModalDocumentIndicesByTokens(
          documents,
          tokens,
          searchOpts,
        );
        if (matched.length === 0) {
          ToastNotification({
            type: "warning",
            message: "No documents in the list matched the uploaded file",
          });
        } else {
          selectedRef.current = mergeSelectedIndices(
            selectedRef.current,
            matched,
          );
          setSelectedCount(selectedRef.current.size);
          setTableTick((t) => t + 1);
          ToastNotification({
            type: "success",
            message: `Selected ${matched.length} document(s) from file`,
          });
        }
        setFile(null);
        return;
      }

      const query = search.trim();
      if (!query) {
        ToastNotification({
          type: "warning",
          message: "Enter a search value or upload a file",
        });
        return;
      }

      const matched = findModalDocumentIndicesBySearch(
        documents,
        query,
        searchOpts,
      );
      if (matched.length === 0) {
        ToastNotification({
          type: "warning",
          message: "No documents matched your search",
        });
        return;
      }

      selectedRef.current = mergeSelectedIndices(selectedRef.current, matched);
      setSelectedCount(selectedRef.current.size);
      setTableTick((t) => t + 1);
      ToastNotification({
        type: "success",
        message: `Selected ${matched.length} document(s)`,
      });
      setSearch("");
    } catch (e) {
      console.error("Failed to select documents from search/file", e);
      ToastNotification({
        type: "error",
        message: "Unable to select documents from the search or file",
      });
    } finally {
      setSelectingFromFile(false);
    }
  }, [file, search, documents, searchOpts]);

  const handleApply = useCallback(() => {
    const sorted = Array.from(selectedRef.current).sort((a, b) => a - b);
    if (sorted.length === 0) {
      ToastNotification({
        type: "warning",
        message: "Please select at least one document",
      });
      return;
    }
    onApply(sorted, documents);
  }, [documents, onApply]);

  const onCountChange = useCallback((count: number) => {
    setSelectedCount(count);
  }, []);

  const footer = useMemo(
    () => (
      <Group justify="flex-end">
        <Button variant="outline" color="#105476" onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="#105476"
          onClick={handleApply}
          disabled={selectedCount === 0}
        >
          Select
        </Button>
      </Group>
    ),
    [onClose, handleApply, selectedCount],
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Select Document"
      size={size}
      styles={selectDocumentModalStyles}
    >
      {overlay}
      {loading ? (
        <Text size="sm" c="dimmed">
          {loadingMessage}
        </Text>
      ) : (
        <SelectDocumentModalLayout
          toolbar={
            <SelectDocumentModalToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={searchPlaceholder}
              selectedFile={file}
              onFileChange={setFile}
              onSelectDocuments={() => {
                void handleSelectDocumentsFromSearchOrFile();
              }}
              selectDocumentsLoading={selectingFromFile}
            />
          }
          footer={footer}
        >
          <DocumentsTable
            visibleRows={visibleRows}
            selectedRef={selectedRef}
            onCountChange={onCountChange}
            tableTick={tableTick}
            tableHeader={tableHeader}
            renderCells={renderCells}
          />
          {documents.length === 0 && (
            <Text size="sm" c="dimmed" mt="sm">
              {emptyListMessage}
            </Text>
          )}
          {noSearchMatches && (
            <Text size="sm" c="dimmed" mt="sm">
              No documents match your search.
            </Text>
          )}
        </SelectDocumentModalLayout>
      )}
    </Modal>
  );
}
