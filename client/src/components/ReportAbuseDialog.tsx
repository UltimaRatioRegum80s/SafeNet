import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reportIncidentAbuse } from "@/lib/apiModeration";
import { useToast } from "@/hooks/use-toast";
import { Flag } from "lucide-react";

interface ReportAbuseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incidentId: string;
}

export default function ReportAbuseDialog({ 
  open, 
  onOpenChange, 
  incidentId 
}: ReportAbuseDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState<"spam" | "harassment" | "misinfo" | "other">("spam");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    try {
      setSubmitting(true);
      await reportIncidentAbuse(incidentId, { 
        reason, 
        note: note.trim() || undefined 
      });
      
      toast({ 
        title: "Report submitted", 
        description: "Thank you for helping keep the community safe." 
      });
      
      onOpenChange(false);
      setNote(""); // Reset form
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Could not submit report", 
        description: error.message 
      });
    } finally { 
      setSubmitting(false); 
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card rounded-2xl border border-gray-700/50 max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-400" />
            <DialogTitle>Report Inappropriate Content</DialogTitle>
          </div>
          <p className="text-sm text-gray-400">
            Help us maintain a safe community by reporting content that violates our guidelines.
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Why are you reporting this?</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full rounded-lg bg-slate-900/40 border border-slate-700 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              data-testid="select-abuse-reason"
            >
              <option value="spam">Spam / advertising</option>
              <option value="harassment">Harassment / hate speech</option>
              <option value="misinfo">Misleading / false information</option>
              <option value="other">Other policy violation</option>
            </select>
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional details (optional)</label>
            <Textarea 
              placeholder="Provide more context about this report..."
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              maxLength={500}
              className="glass-input h-20 resize-none"
              data-testid="textarea-abuse-note"
            />
            <div className="text-xs text-gray-500 text-right">
              {note.length}/500 characters
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-testid="button-cancel-report"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700"
            data-testid="button-submit-report"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}