import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPublicFeed, followPet, unfollowPet, checkFollowing, type FeedStory } from "@/lib/feed-api";
import { toggleLike, checkUserLiked } from "@/lib/community-api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PetProfilePreview } from "./PetProfilePreview";
import { Heart, MessageCircle, Share2, UserPlus, PawPrint } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function FeedCard({ story, isFollowing, isLiked, onFollow, onLike, user }: {
  story: FeedStory;
  isFollowing: boolean;
  isLiked: boolean;
  onFollow: (petId: string) => void;
  onLike: (storyId: string) => void;
  user: any;
}) {
  const navigate = useNavigate();
  const requireAuth = (action: () => void) => {
    if (!user) { navigate("/auth"); return; }
    action();
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 p-4 pb-2">
        <PetProfilePreview
          petName={story.pets.name}
          petPhoto={story.pets.photo_url}
          species={story.pets.species}
          breed={story.pets.breed}
          followersCount={story.pets.followers_count}
        >
          <button className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-primary/20">
              <AvatarImage src={story.pets.photo_url ?? undefined} />
              <AvatarFallback><PawPrint className="h-4 w-4" /></AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground leading-none">{story.pets.name}</p>
              <p className="text-xs text-muted-foreground">{story.profiles.full_name}</p>
            </div>
          </button>
        </PetProfilePreview>
        <div className="ml-auto">
          {!isFollowing ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => requireAuth(() => onFollow(story.pet_id))}
                  disabled={!user ? false : undefined}
                >
                  <UserPlus className="h-3 w-3" /> Follow
                </Button>
              </TooltipTrigger>
              {!user && <TooltipContent>Log in to follow this pet</TooltipContent>}
            </Tooltip>
          ) : (
            <Button size="sm" variant="secondary" className="text-xs" onClick={() => onFollow(story.pet_id)}>
              Following
            </Button>
          )}
        </div>
      </CardHeader>

      {story.photo_urls && story.photo_urls.length > 0 && (
        <AspectRatio ratio={4 / 3}>
          <img
            src={story.photo_urls[0]}
            alt={story.title}
            className="object-cover w-full h-full"
            loading="lazy"
          />
        </AspectRatio>
      )}

      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center gap-1 text-sm transition-colors hover:text-destructive"
                onClick={() => requireAuth(() => onLike(story.id))}
              >
                <Heart className={`h-5 w-5 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
                <span>{story.likes_count}</span>
              </button>
            </TooltipTrigger>
            {!user && <TooltipContent>Log in to like this post</TooltipContent>}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <MessageCircle className="h-5 w-5" />
                <span>{story.comments_count}</span>
              </button>
            </TooltipTrigger>
            {!user && <TooltipContent>Log in to comment</TooltipContent>}
          </Tooltip>

          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <div>
          <p className="text-sm"><span className="font-semibold">{story.pets.name}</span> {story.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">{story.content}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}

export function PublicFeed() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ["publicFeed"],
    queryFn: fetchPublicFeed,
  });

  // Check follows & likes for logged-in user
  useEffect(() => {
    if (!user || stories.length === 0) return;
    const petIds = [...new Set(stories.map((s) => s.pet_id))];
    checkFollowing(petIds, user.id).then(setFollowedSet);

    Promise.all(stories.map((s) => checkUserLiked(s.id, user.id).then((liked) => ({ id: s.id, liked })))).then(
      (results) => setLikedSet(new Set(results.filter((r) => r.liked).map((r) => r.id)))
    );
  }, [user, stories]);

  const followMutation = useMutation({
    mutationFn: async (petId: string) => {
      if (!user) return;
      if (followedSet.has(petId)) {
        await unfollowPet(petId, user.id);
      } else {
        await followPet(petId, user.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publicFeed"] });
      qc.invalidateQueries({ queryKey: ["suggestedPets"] });
      if (user && stories.length) {
        const petIds = [...new Set(stories.map((s) => s.pet_id))];
        checkFollowing(petIds, user.id).then(setFollowedSet);
      }
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (storyId: string) => {
      if (!user) return;
      await toggleLike(storyId, user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publicFeed"] });
      if (user) {
        Promise.all(stories.map((s) => checkUserLiked(s.id, user.id).then((liked) => ({ id: s.id, liked })))).then(
          (results) => setLikedSet(new Set(results.filter((r) => r.liked).map((r) => r.id)))
        );
      }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-80 animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <Card className="p-12 text-center">
        <PawPrint className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg font-semibold text-foreground">No stories yet</p>
        <p className="text-sm text-muted-foreground mt-1">Be the first to share a pet story!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {stories.map((story) => (
        <FeedCard
          key={story.id}
          story={story}
          isFollowing={followedSet.has(story.pet_id)}
          isLiked={likedSet.has(story.id)}
          onFollow={(petId) => followMutation.mutate(petId)}
          onLike={(storyId) => likeMutation.mutate(storyId)}
          user={user}
        />
      ))}
    </div>
  );
}
