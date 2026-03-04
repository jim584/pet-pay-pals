import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { Heart, MessageCircle, DollarSign, Trash2, Send, PawPrint, User } from "lucide-react";
import {
  PetStory, StoryComment, toggleLike, checkUserLiked,
  fetchComments, addComment, deleteComment, sendDonation, deleteStory, STORY_CATEGORIES
} from "@/lib/community-api";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  useEffect(() => {
    if (user) checkUserLiked(story.id, user.id).then(setLiked);
  }, [story.id, user]);

  const handleLike = async () => {
    if (!user) return;
    try {
      const nowLiked = await toggleLike(story.id, user.id);
      setLiked(nowLiked);
      setLikesCount((c) => (nowLiked ? c + 1 : Math.max(c - 1, 0)));
    } catch (err: any) {
      console.error("Like error:", err);
      toast.error("Couldn't process like. Please try again.");
    }
  };

  const loadComments = async () => {
    try {
      const data = await fetchComments(story.id);
      setComments(data);
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
    try {
      await addComment(story.id, user.id, newComment.trim());
      setNewComment("");
      loadComments();
    } catch (err: any) {
      console.error("Add comment error:", err);
      toast.error("Couldn't post comment.");
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
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow duration-300">
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
        <div className={`mx-3 mb-2 overflow-hidden rounded-xl ${story.photo_urls.length === 1 ? "" : "grid grid-cols-2 gap-1"}`}>
          {story.photo_urls.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" className={`w-full object-cover ${story.photo_urls!.length === 1 ? "max-h-80 rounded-xl" : "h-40 rounded-lg"}`} />
          ))}
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
          <Button variant="ghost" size="sm" className={`gap-1.5 rounded-full text-xs ${liked ? "text-destructive bg-destructive/10" : ""}`} onClick={handleLike}>
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            {likesCount}
          </Button>
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
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2.5">
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarImage src={(c as any).profiles?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                  <span className="font-semibold text-xs">{(c as any).profiles?.full_name || "Anonymous"}</span>
                  <p className="text-sm text-foreground/80">{c.content}</p>
                </div>
                {user?.id === c.user_id && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 self-center text-destructive/40 hover:text-destructive" onClick={async () => { await deleteComment(c.id); loadComments(); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Write a comment..."
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
