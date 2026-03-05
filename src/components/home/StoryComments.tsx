import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchComments, addComment, deleteComment, type StoryComment } from "@/lib/community-api";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Trash2, Send, Loader2, Reply, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Props {
  storyId: string;
  isOpen: boolean;
}

function buildThread(comments: StoryComment[]) {
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const byParent = new Map<string, StoryComment[]>();
  for (const c of comments) {
    if (c.parent_comment_id) {
      const arr = byParent.get(c.parent_comment_id) || [];
      arr.push(c);
      byParent.set(c.parent_comment_id, arr);
    }
  }
  return { topLevel, byParent };
}

export function StoryComments({ storyId, isOpen }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<StoryComment | null>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["storyComments", storyId],
    queryFn: () => fetchComments(storyId),
    enabled: isOpen,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: () => addComment(storyId, user!.id, text.trim(), replyingTo?.id),
    onSuccess: () => {
      setText("");
      setReplyingTo(null);
      qc.invalidateQueries({ queryKey: ["storyComments", storyId] });
      qc.invalidateQueries({ queryKey: ["publicFeed"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["storyComments", storyId] });
      qc.invalidateQueries({ queryKey: ["publicFeed"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!text.trim()) return;
    addMutation.mutate();
  };

  if (!isOpen) return null;

  const { topLevel, byParent } = buildThread(comments);

  return (
    <div className="border-t pt-3 space-y-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-2.5 max-h-60 overflow-y-auto">
          {topLevel.map((comment) => (
            <div key={comment.id}>
              <CommentRow
                comment={comment}
                isOwn={user?.id === comment.user_id}
                onDelete={() => deleteMutation.mutate(comment.id)}
                onReply={() => setReplyingTo(comment)}
                isDeleting={deleteMutation.isPending}
                isAuthenticated={!!user}
              />
              {byParent.get(comment.id)?.map((reply) => (
                <div key={reply.id} className="pl-8 mt-1.5">
                  <CommentRow
                    comment={reply}
                    isOwn={user?.id === reply.user_id}
                    onDelete={() => deleteMutation.mutate(reply.id)}
                    onReply={() => setReplyingTo(reply)}
                    isDeleting={deleteMutation.isPending}
                    isAuthenticated={!!user}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
          <Reply className="h-3 w-3" />
          <span>Replying to <span className="font-semibold text-foreground">{replyingTo.profiles?.full_name || "User"}</span></span>
          <button onClick={() => setReplyingTo(null)} className="ml-auto hover:text-foreground"><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? (replyingTo ? "Write a reply..." : "Add a comment...") : "Log in to comment"}
          maxLength={500}
          disabled={!user}
          className="text-sm h-9"
        />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={!text.trim() || addMutation.isPending}
          className="shrink-0 h-9 w-9 p-0"
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}

function CommentRow({
  comment,
  isOwn,
  onDelete,
  onReply,
  isDeleting,
  isAuthenticated,
}: {
  comment: StoryComment;
  isOwn: boolean;
  onDelete: () => void;
  onReply: () => void;
  isDeleting: boolean;
  isAuthenticated: boolean;
}) {
  return (
    <div className="flex items-start gap-2 group">
      <Avatar className="h-6 w-6 mt-0.5 shrink-0">
        <AvatarImage src={comment.profiles?.avatar_url ?? undefined} />
        <AvatarFallback className="text-[9px]">
          <User className="h-3 w-3" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-semibold">{comment.profiles?.full_name || "User"}</span>{" "}
          <span className="text-muted-foreground">{comment.content}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </p>
          {isAuthenticated && (
            <button
              onClick={onReply}
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Reply
            </button>
          )}
        </div>
      </div>
      {isOwn && (
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
          title="Delete comment"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
