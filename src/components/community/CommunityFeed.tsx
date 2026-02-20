import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Heart, MessageCircle, DollarSign, Trash2, Send, PawPrint, User } from "lucide-react";
import {
  PetStory, StoryComment, fetchStories, toggleLike, checkUserLiked,
  fetchComments, addComment, deleteComment, sendDonation, deleteStory
} from "@/lib/community-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function StoryCard({ story, onRefresh }: { story: PetStory; onRefresh: () => void }) {
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
    const nowLiked = await toggleLike(story.id, user.id);
    setLiked(nowLiked);
    setLikesCount((c) => (nowLiked ? c + 1 : Math.max(c - 1, 0)));
  };

  const loadComments = async () => {
    const data = await fetchComments(story.id);
    setComments(data);
  };

  const handleToggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(!showComments);
  };

  const handleAddComment = async () => {
    if (!user || !newComment.trim()) return;
    await addComment(story.id, user.id, newComment.trim());
    setNewComment("");
    loadComments();
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
  const authorName = (story as any).profiles?.full_name || "Anonymous";

  return (
    <Card className="overflow-hidden">
      {/* Photos */}
      {story.photo_urls && story.photo_urls.length > 0 && (
        <div className="grid grid-cols-2 gap-0.5 max-h-80 overflow-hidden">
          {story.photo_urls.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" className={`w-full h-40 object-cover ${story.photo_urls.length === 1 ? "col-span-2 h-64" : ""}`} />
          ))}
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PawPrint className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold font-display text-base">{story.title}</p>
                <p className="text-xs text-muted-foreground">
                  {petName} · by {authorName} · {new Date(story.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          {isAuthor && (
            <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive" onClick={async () => { await deleteStory(story.id); onRefresh(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm">{story.content}</p>

        <div className="flex items-center gap-4 pt-2 border-t">
          <Button variant="ghost" size="sm" className={`gap-1.5 ${liked ? "text-destructive" : ""}`} onClick={handleLike}>
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            {likesCount}
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleToggleComments}>
            <MessageCircle className="h-4 w-4" />
            {story.comments_count}
          </Button>
          {!isAuthor && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-accent ml-auto" onClick={() => setShowDonate(true)}>
              <DollarSign className="h-4 w-4" />
              Donate
            </Button>
          )}
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="space-y-3 pt-2 border-t">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-2 text-sm">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="h-3 w-3" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-xs">{(c as any).profiles?.full_name || "Anonymous"}</span>
                  <p className="text-muted-foreground">{c.content}</p>
                </div>
                {user?.id === c.user_id && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/50" onClick={async () => { await deleteComment(c.id); loadComments(); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                className="text-sm h-9"
              />
              <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Donate dialog */}
      <Dialog open={showDonate} onOpenChange={setShowDonate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Donate to {petName}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">60% goes to Direct Pay (vet only), 40% to Wallet (withdrawable).</p>
          <div className="flex gap-2 mt-2">
            {[5, 10, 25, 50].map((amt) => (
              <Button key={amt} variant={donateAmount === String(amt) ? "default" : "outline"} size="sm" onClick={() => setDonateAmount(String(amt))}>
                ${amt}
              </Button>
            ))}
          </div>
          <Input type="number" min="1" step="0.01" placeholder="Custom amount" value={donateAmount} onChange={(e) => setDonateAmount(e.target.value)} />
          <Button className="w-full" disabled={donating || !donateAmount} onClick={handleDonate}>
            {donating ? "Processing..." : `Donate $${donateAmount || "0"}`}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function CommunityFeed() {
  const [stories, setStories] = useState<PetStory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setStories(await fetchStories());
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="animate-pulse text-muted-foreground text-center py-12">Loading stories...</div>;

  if (stories.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center space-y-2">
          <PawPrint className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">No stories yet. Be the first to share your pet's story!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} onRefresh={load} />
      ))}
    </div>
  );
}
