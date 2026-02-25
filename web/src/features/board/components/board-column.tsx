import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { columnDragId, columnDropId, taskDragId } from "@/features/board/board-utils";
import type { BoardColumn as BoardColumnType } from "@/features/board/types";
import { TaskCard } from "@/features/board/components/task-card";
import { cn } from "@/lib/utils";

interface BoardColumnProps {
  column: BoardColumnType;
  onAddTask: (columnId: string) => void;
  onEditTask: (task: BoardColumnType["tasks"][number]) => void;
  onDeleteTask: (taskId: string) => void;
  deletingTaskId: string | null;
  dragDisabled?: boolean;
  columnDragDisabled?: boolean;
}

function BoardColumnComponent({
  column,
  onAddTask,
  onEditTask,
  onDeleteTask,
  deletingTaskId,
  dragDisabled = false,
  columnDragDisabled = false,
}: BoardColumnProps) {
  const { attributes, listeners, isDragging, setNodeRef, transform, transition } = useSortable({
    id: columnDragId(column.id),
    disabled: columnDragDisabled,
  });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: columnDropId(column.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-[320px] shrink-0 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
        isDragging && "opacity-90 shadow-[0_14px_28px_rgba(15,23,42,0.14)]",
        isOver && "border-blue-200",
      )}
    >
      <div
        className={cn(
          "rounded-lg bg-slate-50/80 px-3 py-2",
          !columnDragDisabled && "cursor-grab active:cursor-grabbing",
        )}
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{column.title}</h2>
          <span className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-500">{column.tasks.length}</span>
        </div>
      </div>

      <div ref={setDropNodeRef} className="mt-3 space-y-3">
        <SortableContext items={column.tasks.map((task) => taskDragId(task.id))} strategy={verticalListSortingStrategy}>
          {column.tasks.length > 0 ? (
            column.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                dragDisabled={dragDisabled}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                isDeleting={deletingTaskId === task.id}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-6 text-center text-xs text-slate-400">
              No tasks yet
            </div>
          )}
        </SortableContext>
      </div>

      <Button
        type="button"
        variant="subtle"
        className="mt-3 h-auto w-full justify-start rounded-md px-2 py-1 text-xs font-medium text-slate-500"
        onClick={() => onAddTask(column.id)}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add Task
      </Button>
    </Card>
  );
}

export const BoardColumn = memo(BoardColumnComponent);
