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

export interface CreateBoardFormValues {
  title: string;
  description?: string;
}

interface CreateBoardDialogProps {
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateBoardFormValues) => void;
}

export function CreateBoardDialog({ open, isSubmitting, onOpenChange, onSubmit }: CreateBoardDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle.length > 0 && !isSubmitting;

  const handleSubmit = () => {
    if (!trimmedTitle) {
      return;
    }

    onSubmit({
      title: trimmedTitle,
      description: description.trim() || undefined,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTitle("");
      setDescription("");
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project Board</DialogTitle>
          <DialogDescription>Start a new board for your team. You can add columns and tasks next.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="board-name" className="text-sm font-medium text-slate-700">
              Board Name
            </label>
            <Input
              id="board-name"
              placeholder="e.g. Q2 Product Delivery"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="board-description" className="text-sm font-medium text-slate-700">
              Description (optional)
            </label>
            <Textarea
              id="board-description"
              placeholder="A short summary of this board's goals."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Creating..." : "Create Board"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
