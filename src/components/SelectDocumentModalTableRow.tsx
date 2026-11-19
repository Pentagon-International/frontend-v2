import { memo, type ReactNode } from "react";
import { Table } from "@mantine/core";

type SelectDocumentModalTableRowProps = {
  index: number;
  checked: boolean;
  onToggle: (index: number) => void;
  children: ReactNode;
};

/**
 * Memoized row so toggling one checkbox does not re-render every document row.
 * Children are intentionally excluded from the equality check — document fields
 * do not change during select/unselect.
 */
function SelectDocumentModalTableRowInner({
  index,
  checked,
  onToggle,
  children,
}: SelectDocumentModalTableRowProps) {
  return (
    <Table.Tr>
      <Table.Td style={{ width: 40 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(index)}
          aria-label={`Select document ${index + 1}`}
          style={{
            width: 16,
            height: 16,
            cursor: "pointer",
            accentColor: "#105476",
          }}
        />
      </Table.Td>
      {children}
    </Table.Tr>
  );
}

const SelectDocumentModalTableRow = memo(
  SelectDocumentModalTableRowInner,
  (prev, next) =>
    prev.checked === next.checked &&
    prev.index === next.index &&
    prev.onToggle === next.onToggle,
);

export default SelectDocumentModalTableRow;
