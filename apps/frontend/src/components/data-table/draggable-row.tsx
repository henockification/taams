import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Row, flexRender } from "@tanstack/react-table";

import { TableCell, TableRow } from "@/components/ui/table";

export function DraggableRow<TData>({ row }: { row: Row<TData> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: (row.original as { id: number }).id,
  });
  
  // Check if row data has isAvailable property for highlighting
  const rowData = row.original as any;
  const isAvailable = rowData?.isAvailable;
  const availabilityClassName = isAvailable === true 
    ? "bg-green-50/50 hover:bg-green-100/50 border-l-4 border-l-green-500" 
    : isAvailable === false 
    ? "bg-red-50/50 hover:bg-red-100/50 border-l-4 border-l-red-500" 
    : "";
  
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className={`relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 ${availabilityClassName}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
      ))}
    </TableRow>
  );
}
