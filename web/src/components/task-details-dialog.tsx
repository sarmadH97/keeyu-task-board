import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TaskPriority } from "@/features/board/types";

export interface TaskDetailsFormValues {
  title: string;
  description: string;
  assigneeName: string;
  priority: TaskPriority;
}

interface TaskDetailsDialogProps {
  open: boolean;
  mode: "create" | "edit";
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TaskDetailsFormValues) => void;
  defaultValues?: Partial<TaskDetailsFormValues>;
}

export function TaskDetailsDialog({
  open,
  mode,
  isSubmitting,
  onOpenChange,
  onSubmit,
  defaultValues,
}: TaskDetailsDialogProps) {
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [description, setDescription] = useState(defaultValues?.description ?? "");
  const [assigneeName, setAssigneeName] = useState(defaultValues?.assigneeName ?? "");
  const [priority, setPriority] = useState<TaskPriority>(defaultValues?.priority ?? "medium");

  const trimmedTitle = title.trim();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTitle(defaultValues?.title ?? "");
      setDescription(defaultValues?.description ?? "");
      setAssigneeName(defaultValues?.assigneeName ?? "");
      setPriority(defaultValues?.priority ?? "medium");
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = () => {
    if (!trimmedTitle) {
      return;
    }

    onSubmit({
      title: trimmedTitle,
      description,
      assigneeName,
      priority,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Task" : "Edit Task"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Enter task details for this column." : "Update the task details."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="task-title" className="text-sm font-medium text-slate-700">
              Title
            </label>
            <Input
              id="task-title"
              placeholder="e.g. Prepare release notes"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="task-description" className="text-sm font-medium text-slate-700">
              Description (optional)
            </label>
            <Textarea
              id="task-description"
              placeholder="Add context for the task."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="task-priority" className="text-sm font-medium text-slate-700">
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="task-assignee" className="text-sm font-medium text-slate-700">
              Assignee Name (optional)
            </label>
            <Input
              id="task-assignee"
              placeholder="e.g. Sarmad"
              value={assigneeName}
              onChange={(event) => setAssigneeName(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={trimmedTitle.length === 0 || isSubmitting}>
            {isSubmitting ? (mode === "create" ? "Adding..." : "Saving...") : mode === "create" ? "Add Task" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
