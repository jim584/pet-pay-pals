import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, MessageSquareWarning } from "lucide-react";

interface Props {
  ticketId: string;
  /** Optional label override */
  label?: string;
}

export function ReconsiderationButton({ ticketId, label = "Request reconsideration" }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (reason.trim().length < 10) return toast.error("Please add a few sentences explaining your request.");
    setBusy(true);
    const { error } = await supabase.from("ticket_reconsideration_requests").insert({
      ticket_id: ticketId,
      requester_id: user.id,
      reason: reason.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reconsideration request submitted");
    setOpen(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <MessageSquareWarning className="h-4 w-4 mr-1.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request reconsideration</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tell an admin why this ticket or reserve-pool decision should be reviewed again.
          Include any new information, attestations, or context that may have changed.
        </p>
        <Textarea
          rows={5}
          placeholder="Why should we re-review this ticket?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
