import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { MessageCircle, DollarSign, Trash2, Send, PawPrint, User, Reply, X, Pencil, Check, AlertTriangle } from "lucide-react";
import { PhotoGrid } from "@/components/shared/PhotoGrid";
import { ReactionPicker } from "@/components/shared/ReactionPicker";
import { ReactionSummary } from "@/components/shared/ReactionSummary";
import { PrayingHands } from "@/components/icons/PrayingHands";
import type { ReactionType } from "@/lib/reactions";
import {
  PetStory, StoryComment, toggleReaction, checkUserReaction,
  fetchComments, addComment, deleteComment, editComment, toggleCommentReaction, batchCheckCommentReactions, batchFetchReactionSummaries, sendDonation, deleteStory, STORY_CATEGORIES
} from "@/lib/community-api";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


export function StoryCard({ story, onRefresh }: { story: PetStory; onRefresh: () => void }) {
  const { user } = useAuth();
  const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(null);
  const [likesCount, setLikesCount] = useState(story.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showDonate, setShowDonate] = useState(false);
  const [donateAmount, setDonateAmount] = useState("");
  const [donating, setDonating] = useState(false);
  const [replyingTo, setReplyingTo] = useState<StoryComment | null>(null);
  const [commentReactionsMap, setCommentReactionsMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (user) checkUserReaction(story.id, user.id).then((r) => setCurrentReaction(r as ReactionType | null));
  }, [story.id, user]);

  const handleReact = async (type: ReactionType) => {
    if (!user) return;
    const wasReacted = currentReaction;
    const isSameReaction = currentReaction === type;
    // Optimistic
    setCurrentReaction(isSameReaction ? null : type);
    setLikesCount((c) => isSameReaction ? Math.max(c - 1, 0) : (wasReacted ? c : c + 1));
    try {
      await toggleReaction(story.id, user.id, type);
    } catch (err: any) {
      setCurrentReaction(wasReacted);
      setLikesCount((c) => isSameReaction ? c + 1 : (wasReacted ? c : Math.max(c - 1, 0)));
      console.error("Reaction error:", err);
      toast.error("Couldn't process reaction. Please try again.");
    }
  };

  const loadComments = async () => {
    try {
      const data = await fetchComments(story.id);
      setComments(data);
      if (user) {
        const reactions = await batchCheckCommentReactions(data.map((c) => c.id), user.id);
        setCommentReactionsMap(reactions);
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

  return (
    <Card className={`overflow-hidden rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow duration-300 ${story.is_urgent ? "ring-2 ring-destructive/40 border-destructive/30" : ""}`}>
      {/* Urgent banner */}
      {story.is_urgent && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-destructive/10 text-destructive text-xs font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          URGENT — Critical Case
        </div>
      )}
      {/* Author header — social media pattern */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
          <AvatarImage src={authorAvatar ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary"><User className="h-4 w-4" /></AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm font-display truncate">{authorName}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PawPrint className="h-3 w-3" />
            <span className="truncate">{petName}</span>
            <span>·</span>
            <span>{new Date(story.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        {isAuthor && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:text-destructive" onClick={async () => { await deleteStory(story.id); onRefresh(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Photos */}
      {story.photo_urls && story.photo_urls.length > 0 && (
        <div className="mx-3 mb-2 overflow-hidden rounded-xl">
          <PhotoGrid photos={story.photo_urls} maxHeight="max-h-80" />
        </div>
      )}

      <CardContent className="px-4 pb-4 pt-1 space-y-3">
        <div>
          {story.category && story.category !== "general" && (() => {
            const cat = STORY_CATEGORIES.find((c) => c.value === story.category);
            return cat ? (
              <Badge variant="secondary" className={`mb-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border-none ${cat.color}`}>
                {cat.label}
              </Badge>
            ) : null;
          })()}
          <p className="font-bold font-display text-base mb-1">{story.title}</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{story.content}</p>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <ReactionPicker
            currentReaction={currentReaction}
            onReact={handleReact}
            totalCount={likesCount}
          />
          <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-xs" onClick={handleToggleComments}>
            <MessageCircle className="h-4 w-4" />
            {story.comments_count}
          </Button>
          {!isAuthor && (
            <Button
              size="sm"
              className="gap-1.5 rounded-full text-xs ml-auto bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
              onClick={() => setShowDonate(true)}
            >
              <DollarSign className="h-4 w-4" />
              Donate
            </Button>
          )}
        </div>

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
                  <CommentBubble c={c} user={user} currentReaction={(commentReactionsMap.get(c.id) as ReactionType) ?? null} onReact={async (type) => { if (!user) return; await toggleCommentReaction(c.id, user.id, type); loadComments(); }} onDelete={() => { deleteComment(c.id); loadComments(); }} onEdit={async (content) => { await editComment(c.id, content); loadComments(); }} onReply={() => setReplyingTo(c)} />
                  {byParent.get(c.id)?.map((reply) => (
                    <div key={reply.id} className="pl-8 mt-1.5">
                      <CommentBubble c={reply} user={user} currentReaction={(commentReactionsMap.get(reply.id) as ReactionType) ?? null} onReact={async (type) => { if (!user) return; await toggleCommentReaction(reply.id, user.id, type); loadComments(); }} onDelete={() => { deleteComment(reply.id); loadComments(); }} onEdit={async (content) => { await editComment(reply.id, content); loadComments(); }} onReply={() => setReplyingTo(reply)} />
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
      </CardContent>

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

function CommentBubble({ c, user, currentReaction, onReact, onDelete, onEdit, onReply }: { c: StoryComment; user: any; currentReaction: ReactionType | null; onReact: (type: ReactionType) => void; onDelete: () => void; onEdit: (content: string) => void; onReply: () => void }) {
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
          <ReactionPicker
            currentReaction={currentReaction}
            onReact={onReact}
            totalCount={c.likes_count}
            size="sm"
          />
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
