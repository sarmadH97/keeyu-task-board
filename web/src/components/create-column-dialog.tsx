import { useEffect, useState } from "react";

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

export interface CreateColumnFormValues {
  title: string;
}

interface CreateColumnDialogProps {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateColumnFormValues) => void;
}

export function CreateColumnDialog({ open, isSubmitting, onOpenChange, onSubmit }: CreateColumnDialogProps) {
  const [title, setTitle] = useState("");
  const trimmedTitle = title.trim();

  useEffect(() => {
    if (!open) {
      setTitle("");
    }
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTitle("");
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = () => {
    if (!trimmedTitle) {
      return;
    }

    onSubmit({ title: trimmedTitle });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Column</DialogTitle>
          <DialogDescription>Create a new column for this board.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2">
          <label htmlFor="column-name" className="text-sm font-medium text-slate-700">
            Column Name
          </label>
          <Input
            id="column-name"
            placeholder="e.g. In Progress"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={trimmedTitle.length === 0 || isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Column"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
