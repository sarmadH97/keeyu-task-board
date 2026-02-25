import { memo, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { taskDragId } from "@/features/board/board-utils";
import { PRIORITY_STYLE } from "@/features/board/constants";
import type { Task } from "@/features/board/types";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  dragDisabled?: boolean;
  onEdit: (task: Task) => void;
  onDuplicate: (task: Task) => void;
  onDelete: (taskId: string) => void;
  actionsDisabled?: boolean;
  isDeleting?: boolean;
}

function formatDate(input: string | null | undefined): string {
  if (!input) {
    return "Updated recently";
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return "Updated recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function TaskCardComponent({
  task,
  dragDisabled = false,
  onEdit,
  onDuplicate,
  onDelete,
  actionsDisabled = false,
  isDeleting = false,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskDragId(task.id),
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityClassName = PRIORITY_STYLE[task.priority];
  const metadataText = useMemo(() => formatDate(task.updatedAt), [task.updatedAt]);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab rounded-lg border border-slate-200/80 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition-shadow duration-200",
        "hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
        isDragging && "cursor-grabbing opacity-80 shadow-[0_14px_28px_rgba(15,23,42,0.12)]",
        dragDisabled && "cursor-default",
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5 text-slate-700">{task.title}</p>
        <div className="flex items-center gap-1">
          <Badge className={priorityClassName}>{task.priority}</Badge>
          <Button
            type="button"
            size="icon"
            variant="subtle"
            className="h-6 w-6 rounded-md text-slate-400 hover:text-slate-600"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(task);
            }}
            disabled={actionsDisabled}
            aria-label={`Edit ${task.title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="subtle"
            className="h-6 w-6 rounded-md text-slate-400 hover:text-slate-600"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(task);
            }}
            disabled={actionsDisabled}
            aria-label={`Duplicate ${task.title}`}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="subtle"
            className="h-6 w-6 rounded-md text-slate-400 hover:text-red-500"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete(task.id);
            }}
            disabled={isDeleting || actionsDisabled}
            aria-label={`Delete ${task.title}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {task.description ? <p className="mt-2 text-xs leading-5 text-slate-500">{task.description}</p> : null}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>{metadataText}</span>
        <span>{task.assigneeName ?? "Unassigned"}</span>
      </div>
    </Card>
  );
}

export const TaskCard = memo(TaskCardComponent);

interface TaskCardPreviewProps {
  task: Task;
}

export function TaskCardPreview({ task }: TaskCardPreviewProps) {
  return (
    <Card className="w-[300px] rounded-lg border border-slate-200/80 bg-white p-3 shadow-[0_14px_28px_rgba(15,23,42,0.14)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5 text-slate-700">{task.title}</p>
        <Badge className={PRIORITY_STYLE[task.priority]}>{task.priority}</Badge>
      </div>
      {task.description ? <p className="mt-2 text-xs leading-5 text-slate-500">{task.description}</p> : null}
    </Card>
  );
}
