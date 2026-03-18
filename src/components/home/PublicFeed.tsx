import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPublicFeed, followPet, unfollowPet, checkFollowing, FEED_PAGE_SIZE, type FeedStory } from "@/lib/feed-api";
import { toggleLike, batchCheckLiked, STORY_CATEGORIES } from "@/lib/community-api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhotoGrid } from "@/components/shared/PhotoGrid";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { PetProfilePreview } from "./PetProfilePreview";
import { StoryComments } from "./StoryComments";
import { MessageCircle, Share2, UserPlus, PawPrint, User, X, RefreshCw, Search, ArrowLeft, ArrowRight } from "lucide-react";
import { PrayingHands } from "@/components/icons/PrayingHands";
import { formatDistanceToNow } from "date-fns";

const SAMPLE_STORIES: FeedStory[] = [
  {
    id: "sample-1",
    pet_id: "sample-pet-1",
    author_id: "sample-author-1",
    title: "had the best day at the park! 🌳",
    content: "We spent the whole afternoon chasing squirrels and making new friends. Max even learned to catch a frisbee mid-air! So proud of this little guy.",
    category: "milestone",
    photo_urls: ["https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=600&fit=crop"],
    likes_count: 24,
    comments_count: 5,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    pets: { name: "Max", photo_url: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=100&h=100&fit=crop", species: "dog", breed: "Golden Retriever", followers_count: 142 },
    profiles: { full_name: "Sarah Mitchell", avatar_url: null },
  },
  {
    id: "sample-2",
    pet_id: "sample-pet-2",
    author_id: "sample-author-2",
    title: "nap queen strikes again 😴",
    content: "Luna found a sunny spot on the couch and hasn't moved in 3 hours. Living her best life honestly. Who else has a cat that sleeps 20 hours a day?",
    category: "general",
    photo_urls: ["https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&h=600&fit=crop"],
    likes_count: 38,
    comments_count: 12,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    pets: { name: "Luna", photo_url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=100&h=100&fit=crop", species: "cat", breed: "British Shorthair", followers_count: 89 },
    profiles: { full_name: "James Cooper", avatar_url: null },
  },
  {
    id: "sample-3",
    pet_id: "sample-pet-3",
    author_id: "sample-author-3",
    title: "first swim of the summer! 🏊",
    content: "Buddy was so scared at first but once he got in, we couldn't get him out! He's officially a water dog now. Can't wait for more beach days together.",
    category: "recovery",
    photo_urls: ["https://images.unsplash.com/photo-1558788353-f76d92427f16?w=800&h=600&fit=crop"],
    likes_count: 56,
    comments_count: 8,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    pets: { name: "Buddy", photo_url: "https://images.unsplash.com/photo-1558788353-f76d92427f16?w=100&h=100&fit=crop", species: "dog", breed: "Labrador", followers_count: 203 },
    profiles: { full_name: "Emily Rodriguez", avatar_url: null },
  },
  {
    id: "sample-4",
    pet_id: "sample-pet-4",
    author_id: "sample-author-4",
    title: "adopted this sweet girl today! 🎉",
    content: "Meet Bella! She's a 2-year-old rescue and she already feels like family. She curled up in my lap within 10 minutes of coming home. Adopt, don't shop! ❤️",
    category: "adoption",
    photo_urls: ["https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800&h=600&fit=crop"],
    likes_count: 91,
    comments_count: 22,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    pets: { name: "Bella", photo_url: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=100&h=100&fit=crop", species: "cat", breed: "Tabby", followers_count: 67 },
    profiles: { full_name: "Michael Chen", avatar_url: null },
  },
  {
    id: "sample-5",
    pet_id: "sample-pet-5",
    author_id: "sample-author-5",
    title: "graduated puppy school! 🎓",
    content: "Charlie passed his obedience training with flying colors! He can now sit, stay, shake, and roll over. Treats were definitely the secret weapon 🦴",
    category: "milestone",
    photo_urls: ["https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800&h=600&fit=crop"],
    likes_count: 43,
    comments_count: 15,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    pets: { name: "Charlie", photo_url: "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=100&h=100&fit=crop", species: "dog", breed: "Beagle", followers_count: 178 },
    profiles: { full_name: "Lisa Thompson", avatar_url: null },
  },
  {
    id: "sample-6",
    pet_id: "sample-pet-6",
    author_id: "sample-author-6",
    title: "someone loves the snow! ❄️",
    content: "Took Daisy out for her first snow day and she went absolutely crazy! Zoomies for 20 minutes straight. She tried to eat every snowflake. Winter is officially her favorite season 🐾",
    category: "rescue",
    photo_urls: ["https://images.unsplash.com/photo-1477884213360-7e9d7dcc8f9b?w=800&h=600&fit=crop"],
    likes_count: 67,
    comments_count: 18,
    created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    pets: { name: "Daisy", photo_url: "https://images.unsplash.com/photo-1477884213360-7e9d7dcc8f9b?w=100&h=100&fit=crop", species: "dog", breed: "Husky", followers_count: 312 },
    profiles: { full_name: "Olivia Park", avatar_url: null },
  },
];

function FeedCard({ story, isFollowing, isLiked, onFollow, onLike, user, isSample, onImageClick }: {
  story: FeedStory;
  isFollowing: boolean;
  isLiked: boolean;
  onFollow: (petId: string) => void;
  onLike: (storyId: string) => void;
  user: any;
  isSample?: boolean;
  onImageClick: (url: string, alt: string) => void;
}) {
  const navigate = useNavigate();
  const [commentsOpen, setCommentsOpen] = useState(false);
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
              <div className="flex items-center gap-1 mt-0.5">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={story.profiles.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[8px]"><User className="h-2.5 w-2.5" /></AvatarFallback>
                </Avatar>
                <p className="text-xs text-muted-foreground">{story.profiles.full_name}</p>
              </div>
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
                  onClick={() => isSample ? navigate("/auth") : requireAuth(() => onFollow(story.pet_id))}
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
        <PhotoGrid
          photos={story.photo_urls}
          alt={story.title}
          onImageClick={(url) => onImageClick(url, story.title)}
        />
      )}

      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center gap-1 text-sm transition-colors hover:text-amber-500"
                onClick={() => isSample ? navigate("/auth") : requireAuth(() => onLike(story.id))}
              >
                <PrayingHands className={`h-5 w-5 transition-opacity ${isLiked ? "opacity-100" : "opacity-50"}`} />
                <span>{story.likes_count}</span>
              </button>
            </TooltipTrigger>
            {!user && <TooltipContent>Log in to like this post</TooltipContent>}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`flex items-center gap-1 text-sm transition-colors hover:text-foreground ${commentsOpen ? "text-foreground" : "text-muted-foreground"}`}
                onClick={() => isSample ? navigate("/auth") : setCommentsOpen((v) => !v)}
              >
                <MessageCircle className={`h-5 w-5 ${commentsOpen ? "fill-primary/20 text-primary" : ""}`} />
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
          {story.category && story.category !== "general" && (() => {
            const cat = STORY_CATEGORIES.find((c) => c.value === story.category);
            return cat ? (
              <Badge variant="secondary" className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border-none ${cat.color}`}>
                {cat.label}
              </Badge>
            ) : null;
          })()}
          <p className="text-sm"><span className="font-semibold">{story.pets.name}</span> {story.title}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">{story.content}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}
        </p>

        {!isSample && <StoryComments storyId={story.id} isOpen={commentsOpen} />}
      </CardContent>
    </Card>
  );
}

export function PublicFeed({ search, category }: { search?: string; category?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["publicFeed"],
    queryFn: ({ pageParam = 0 }) => fetchPublicFeed(pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === FEED_PAGE_SIZE ? allPages.length : undefined,
    initialPageParam: 0,
    retry: false,
    staleTime: 60_000,
  });

  const handleRefresh = () => {
    refetch();
  };

  const stories: FeedStory[] = data?.pages.flat() ?? [];
  // Stable key to avoid infinite re-renders
  const storyIds = stories.map((s) => s.id).join(",");

  // Check follows & likes for logged-in user
  useEffect(() => {
    if (!user || stories.length === 0) return;
    const petIds = [...new Set(stories.map((s) => s.pet_id))];
    checkFollowing(petIds, user.id).then(setFollowedSet);

    batchCheckLiked(stories.map((s) => s.id), user.id).then(setLikedSet);
  }, [user, storyIds]);

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
      // Optimistic toggle
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (next.has(storyId)) next.delete(storyId);
        else next.add(storyId);
        return next;
      });
      await toggleLike(storyId, user.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["publicFeed"] });
    },
  });

  // Use real stories if available, otherwise show sample data immediately
  const allStories = stories.length > 0 ? stories : SAMPLE_STORIES;
  const isSampleData = stories.length === 0;

  const displayStories = allStories.filter((story) => {
    const matchesCategory = !category || category === "all" || story.category === category;
    const q = search?.toLowerCase().trim();
    const matchesSearch = !q || [story.title, story.content, story.pets.name, story.profiles.full_name]
      .some((f) => f?.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; alt: string } | null>(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Latest Stories</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefetching}
          className="gap-1.5 text-xs text-muted-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          {isRefetching ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {displayStories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">No stories found</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different search term or category</p>
        </div>
      ) : displayStories.map((story) => (
        <FeedCard
          key={story.id}
          story={story}
          isFollowing={followedSet.has(story.pet_id)}
          isLiked={likedSet.has(story.id)}
          onFollow={(petId) => followMutation.mutate(petId)}
          onLike={(storyId) => likeMutation.mutate(storyId)}
          user={user}
          isSample={isSampleData}
          onImageClick={(url, alt) => {
            const photos = story.photo_urls || [url];
            const index = photos.indexOf(url);
            setLightbox({ photos, index: index >= 0 ? index : 0, alt });
          }}
        />
      ))}
      

      {/* Load More button */}
      {!isSampleData && hasNextPage && (
        <div className="flex justify-center pt-2 pb-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full max-w-xs"
          >
            {isFetchingNextPage ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading...
              </span>
            ) : (
              "Load More Stories"
            )}
          </Button>
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-transparent shadow-none [&>button]:hidden overflow-visible">
          <div className="relative w-full h-full">
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-4 -right-4 z-50 rounded-full bg-background p-2 shadow-lg hover:bg-accent transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            {lightbox && (
              <>
                {lightbox.photos.length > 1 && (
                  <div className="absolute top-3 left-3 z-50 bg-black/60 backdrop-blur text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    {lightbox.index + 1}/{lightbox.photos.length}
                  </div>
                )}
                {lightbox.index > 0 && (
                  <button
                    onClick={() => setLightbox((prev) => prev ? { ...prev, index: prev.index - 1 } : null)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-50 h-11 w-11 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center shadow-lg hover:bg-black/80 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                {lightbox.index < lightbox.photos.length - 1 && (
                  <button
                    onClick={() => setLightbox((prev) => prev ? { ...prev, index: prev.index + 1 } : null)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-50 h-11 w-11 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center shadow-lg hover:bg-black/80 transition-colors"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </button>
                )}
                <img
                  src={lightbox.photos[lightbox.index]}
                  alt={lightbox.alt}
                  className="w-full h-full max-h-[85vh] object-contain rounded-lg"
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

