import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, Send, Paperclip, X, FileText, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  listTicketMessages, sendTicketMessage, markTicketMessagesRead,
  getTicketUnreadCount, subscribeToTicketMessages,
  uploadMessageAttachment, getMessageAttachmentUrl,
  type TicketMessage, type TicketMessageRole, type TicketAttachment,
} from "@/lib/vet-ticket-messages-api";

const ROLE_LABEL: Record<TicketMessageRole, string> = {
  owner: "Owner", vet: "Vet", admin: "Admin",
};

export function TicketMessagesDialog({
  ticketId, viewerRole, triggerSize = "sm",
}: {
  ticketId: string;
  viewerRole: TicketMessageRole;
  triggerSize?: "sm" | "default";
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Refresh unread badge periodically + on mount
  const refreshUnread = async () => {
    setUnread(await getTicketUnreadCount(ticketId, viewerRole));
  };
  useEffect(() => {
    refreshUnread();
    const unsub = subscribeToTicketMessages(ticketId, () => {
      refreshUnread();
      if (open) load();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, viewerRole, open]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listTicketMessages(ticketId);
      setMessages(list);
      await markTicketMessagesRead(ticketId, viewerRole);
      await refreshUnread();
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendTicketMessage(ticketId, draft);
      setDraft("");
      await load();
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={triggerSize} className="relative">
          <MessageSquare className="h-4 w-4 mr-1" />
          Messages
          {unread > 0 && (
            <span className="ml-2 inline-flex items-center justify-center text-[10px] font-semibold rounded-full bg-primary text-primary-foreground h-4 min-w-4 px-1">
              {unread}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ticket conversation</DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 min-h-[240px] max-h-[50vh]">
          {loading ? (
            <div className="text-muted-foreground text-sm animate-pulse">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-8">
              No messages yet. Start the conversation below.
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs">{m.sender_name || "User"}</span>
                      <Badge variant={mine ? "secondary" : "outline"} className="text-[10px] px-1 py-0 h-4">
                        {ROLE_LABEL[m.sender_role]}
                      </Badge>
                      <span className={`text-[10px] ${mine ? "opacity-80" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t pt-3 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            }}
            placeholder="Write a message… (Cmd/Ctrl+Enter to send)"
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={send} disabled={sending || !draft.trim()}>
              {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
