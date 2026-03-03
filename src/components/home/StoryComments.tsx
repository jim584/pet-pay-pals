import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchComments, addComment, deleteComment, type StoryComment } from "@/lib/community-api";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Trash2, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Props {
  storyId: string;
  isOpen: boolean;
}

export function StoryComments({ storyId, isOpen }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["storyComments", storyId],
    queryFn: () => fetchComments(storyId),
    enabled: isOpen,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: () => addComment(storyId, user!.id, text.trim()),
    onSuccess: () => {
      setText("");
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

  return (
    <div className="border-t pt-3 space-y-3">
      {/* Comment list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-2.5 max-h-60 overflow-y-auto">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              isOwn={user?.id === comment.user_id}
              onDelete={() => deleteMutation.mutate(comment.id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? "Add a comment..." : "Log in to comment"}
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
  isDeleting,
}: {
  comment: StoryComment;
  isOwn: boolean;
  onDelete: () => void;
  isDeleting: boolean;
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
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
        </p>
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
