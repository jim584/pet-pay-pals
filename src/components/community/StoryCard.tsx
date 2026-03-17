import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { MessageCircle, DollarSign, Trash2, Send, PawPrint, User, Reply, X, Check, AlertTriangle, Bookmark, MoreHorizontal } from "lucide-react";
import { PrayingHands } from "@/components/icons/PrayingHands";
import {
  PetStory, StoryComment, toggleLike, checkUserLiked,
  fetchComments, addComment, deleteComment, editComment, toggleCommentLike, batchCheckCommentLiked, sendDonation, deleteStory, STORY_CATEGORIES
} from "@/lib/community-api";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

export function StoryCard({ story, onRefresh }: { story: PetStory; onRefresh: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(story.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showDonate, setShowDonate] = useState(false);
  const [donateAmount, setDonateAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [replyingTo, setReplyingTo] = useState<StoryComment | null>(null);
  const [commentLikedSet, setCommentLikedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) checkUserLiked(story.id, user.id).then(setLiked);
  }, [story.id, user]);

  const handleLike = async () => {
    if (!user) return;
    // Optimistic update
    setLiked((prev) => !prev);
    setLikesCount((c) => (liked ? Math.max(c - 1, 0) : c + 1));
    try {
      await toggleLike(story.id, user.id);
    } catch (err: any) {
      // Revert on error
      setLiked((prev) => !prev);
      setLikesCount((c) => (liked ? c + 1 : Math.max(c - 1, 0)));
      console.error("Like error:", err);
      toast.error("Couldn't process like. Please try again.");
    }
  };

  const loadComments = async () => {
    try {
      const data = await fetchComments(story.id);
      setComments(data);
      if (user) {
        const liked = await batchCheckCommentLiked(data.map((c) => c.id), user.id);
        setCommentLikedSet(liked);
      }
    } catch (err: any) {
      console.error("Comments error:", err);
      toast.error("Couldn't load comments.");
    }
  };

  const handleToggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(!showComments);
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;
    const commentText = newComment.trim();
    const parentId = replyingTo?.id;
    setNewComment("");
    setReplyingTo(null);
    const now = new Date().toISOString();
    const tempComment: StoryComment = {
      id: `temp-${Date.now()}`,
      story_id: story.id,
      user_id: user.id,
      content: commentText,
      parent_comment_id: parentId || null,
      likes_count: 0,
      created_at: now,
      updated_at: now,
      profiles: { full_name: user.user_metadata?.full_name || "You", avatar_url: user.user_metadata?.avatar_url || null },
    };
    setComments((prev) => [...prev, tempComment]);
    try {
      await addComment(story.id, user.id, commentText, parentId);
      await loadComments();
    } catch (err: any) {
      console.error("Add comment error:", err);
      toast.error("Couldn't post comment.");
      setComments((prev) => prev.filter((c) => c.id !== tempComment.id));
    }
  };

  const handleDonate = async () => {
    if (!user || !donateAmount) return;
    const amount = parseFloat(donateAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setDonating(true);
    try {
      await sendDonation(user.id, story.author_id, amount, story.id);
      toast.success(`$${amount.toFixed(2)} donated! 60% → Direct Pay, 40% → Wallet`);
      setShowDonate(false);
      setDonateAmount("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDonating(false);
    }
  };

  const isAuthor = user?.id === story.author_id;
  const petName = (story as any).pets?.name || "Unknown Pet";
  const petPhoto = (story as any).pets?.photo_url || null;
  const authorName = (story as any).profiles?.full_name || "Anonymous";
  const authorAvatar = (story as any).profiles?.avatar_url || null;

  const relativeTime = formatDistanceToNow(new Date(story.created_at), { addSuffix: false });

  return (
    <article className={`bg-card border-b border-border/40 ${story.is_urgent ? "bg-destructive/[0.03]" : ""}`}>
      {/* Urgent banner */}
      {story.is_urgent && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-destructive/10 text-destructive text-xs font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          URGENT — Critical Case
        </div>
      )}

      {/* Author header — Instagram style */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar className="h-8 w-8">
          <AvatarImage src={authorAvatar ?? undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground text-xs"><User className="h-3.5 w-3.5" /></AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">{authorName}</span>
            {story.is_urgent && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 rounded">Urgent</Badge>}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <PawPrint className="h-2.5 w-2.5" />
            <span className="truncate">{petName}</span>
          </div>
        </div>
        {isAuthor ? (
          <button onClick={async () => { await deleteStory(story.id); onRefresh(); }} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Photos — edge-to-edge */}
      {story.photo_urls && story.photo_urls.length > 0 && (
        <div className={`w-full overflow-hidden ${story.photo_urls.length === 1 ? "" : "grid grid-cols-2 gap-px bg-border"}`}>
          {story.photo_urls.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" className={`w-full object-cover ${story.photo_urls!.length === 1 ? "aspect-square" : "aspect-square"}`} />
          ))}
        </div>
      )}

      {/* Action bar — icon-only, Instagram style */}
      <div className="flex items-center px-3 py-2">
        <div className="flex items-center gap-3">
          <button onClick={handleLike} className={`transition-colors ${liked ? "text-amber-500" : "text-foreground hover:text-muted-foreground"}`}>
            <PrayingHands className="h-6 w-6" />
          </button>
          <button onClick={handleToggleComments} className="text-foreground hover:text-muted-foreground transition-colors">
            <MessageCircle className="h-6 w-6" />
          </button>
          {!isAuthor && (
            <button onClick={() => setShowDonate(true)} className="text-foreground hover:text-muted-foreground transition-colors">
              <DollarSign className="h-6 w-6" />
            </button>
          )}
        </div>
        <button className="ml-auto text-foreground hover:text-muted-foreground transition-colors">
          <Bookmark className="h-6 w-6" />
        </button>
      </div>

      {/* Likes count */}
      {likesCount > 0 && (
        <p className="px-3 text-sm font-semibold">{likesCount} prayer{likesCount !== 1 ? "s" : ""}</p>
      )}

      {/* Caption — Instagram inline style */}
      <div className="px-3 pb-1">
        {story.category && story.category !== "general" && (() => {
          const cat = STORY_CATEGORIES.find((c) => c.value === story.category);
          return cat ? (
            <Badge variant="secondary" className={`mr-1.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0 h-4 rounded border-none ${cat.color}`}>
              {cat.label}
            </Badge>
          ) : null;
        })()}
        <p className="text-sm">
          <span className="font-semibold">{authorName}</span>{" "}
          <span className="font-semibold">{story.title}</span>{" "}
          <span className="text-foreground/80">{story.content}</span>
        </p>
      </div>

      {/* Comments count link */}
      {story.comments_count > 0 && !showComments && (
        <button onClick={handleToggleComments} className="px-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          View all {story.comments_count} comment{story.comments_count !== 1 ? "s" : ""}
        </button>
      )}

      {/* Timestamp */}
      <p className="px-3 pt-1 pb-3 text-[10px] uppercase tracking-wide text-muted-foreground">{relativeTime} ago</p>

        {/* Comments section */}
        {showComments && (
          <div className="space-y-3 pt-3 border-t border-border/50">
            {comments.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No comments yet — be the first!</p>
            )}
            {(() => {
              const topLevel = comments.filter((c) => !c.parent_comment_id);
              const byParent = new Map<string, StoryComment[]>();
              for (const c of comments) {
                if (c.parent_comment_id) {
                  const arr = byParent.get(c.parent_comment_id) || [];
                  arr.push(c);
                  byParent.set(c.parent_comment_id, arr);
                }
              }
              return topLevel.map((c) => (
                <div key={c.id}>
                  <CommentBubble c={c} user={user} liked={commentLikedSet.has(c.id)} onLike={async () => { if (!user) return; await toggleCommentLike(c.id, user.id); loadComments(); }} onDelete={() => { deleteComment(c.id); loadComments(); }} onEdit={async (content) => { await editComment(c.id, content); loadComments(); }} onReply={() => setReplyingTo(c)} />
                  {byParent.get(c.id)?.map((reply) => (
                    <div key={reply.id} className="pl-8 mt-1.5">
                      <CommentBubble c={reply} user={user} liked={commentLikedSet.has(reply.id)} onLike={async () => { if (!user) return; await toggleCommentLike(reply.id, user.id); loadComments(); }} onDelete={() => { deleteComment(reply.id); loadComments(); }} onEdit={async (content) => { await editComment(reply.id, content); loadComments(); }} onReply={() => setReplyingTo(reply)} />
                    </div>
                  ))}
                </div>
              ));
            })()}
            {replyingTo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
                <Reply className="h-3 w-3" />
                <span>Replying to <span className="font-semibold text-foreground">{(replyingTo as any).profiles?.full_name || "User"}</span></span>
                <button onClick={() => setReplyingTo(null)} className="ml-auto hover:text-foreground"><X className="h-3 w-3" /></button>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                className="text-sm h-9 rounded-full bg-muted border-none"
              />
              <Button size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={handleAddComment} disabled={!newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      

      {/* Donate dialog */}
      <Dialog open={showDonate} onOpenChange={setShowDonate}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Donate to {petName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">60% goes to Direct Pay (vet only), 40% to Wallet (withdrawable).</p>
          <div className="flex gap-2 mt-2">
            {[5, 10, 25, 50].map((amt) => (
              <Button key={amt} variant={donateAmount === String(amt) ? "default" : "outline"} size="sm" className="rounded-full flex-1" onClick={() => setDonateAmount(String(amt))}>
                ${amt}
              </Button>
            ))}
          </div>
          <Input type="number" min="1" step="0.01" placeholder="Custom amount" value={donateAmount} onChange={(e) => setDonateAmount(e.target.value)} className="rounded-xl" />
          <Button className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90" disabled={donating || !donateAmount} onClick={handleDonate}>
            {donating ? "Processing..." : `Donate $${donateAmount || "0"}`}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CommentBubble({ c, user, liked, onLike, onDelete, onEdit, onReply }: { c: StoryComment; user: any; liked: boolean; onLike: () => void; onDelete: () => void; onEdit: (content: string) => void; onReply: () => void }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.content);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === c.content) {
      setEditing(false);
      setEditText(c.content);
      return;
    }
    onEdit(trimmed);
    setEditing(false);
  };

  return (
    <div className="flex gap-2.5 group">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarImage src={(c as any).profiles?.avatar_url ?? undefined} />
        <AvatarFallback className="text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
      </Avatar>
      <div className="flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") { setEditing(false); setEditText(c.content); } }}
              maxLength={500}
              className="text-sm h-7 flex-1 rounded-full bg-muted border-none"
              autoFocus
            />
            <button onClick={handleSaveEdit} className="p-1 text-primary hover:text-primary/80" title="Save">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setEditing(false); setEditText(c.content); }} className="p-1 text-muted-foreground hover:text-foreground" title="Cancel">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
            <span className="font-semibold text-xs">{(c as any).profiles?.full_name || "Anonymous"}</span>
            <p className="text-sm text-foreground/80">{c.content}</p>
          </div>
        )}
        <div className="flex items-center gap-2.5 ml-2 mt-0.5">
          {c.updated_at !== c.created_at && (
            <span className="text-[10px] italic text-muted-foreground">(edited)</span>
          )}
          <button
            onClick={onLike}
            className={`flex items-center gap-0.5 text-[10px] font-medium transition-colors ${liked ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
          >
            <PrayingHands className={`h-2.5 w-2.5 transition-opacity ${liked ? "opacity-100" : "opacity-50"}`} />
            {c.likes_count > 0 && <span>{c.likes_count}</span>}
          </button>
          {user && (
            <button onClick={onReply} className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
              Reply
            </button>
          )}
          {user?.id === c.user_id && !editing && (
            <button onClick={() => setEditing(true)} className="text-[10px] font-medium text-muted-foreground hover:text-foreground">
              Edit
            </button>
          )}
        </div>
      </div>
      {user?.id === c.user_id && !editing && (
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 self-center text-destructive/40 hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
