import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShieldOff, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { BlogCard, type BlogPost } from "@/components/fearfreed/BlogCard";

const DUMMY_POSTS: BlogPost[] = [
  {
    id: "1",
    title: "How to Help Your Dog Overcome Thunderstorm Anxiety",
    summary: "Thunderstorms can be terrifying for dogs. Learn proven techniques including desensitization, pressure wraps, and safe spaces to help your furry friend stay calm during storms.",
    imageUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=340&fit=crop",
    category: "Anxiety",
    readTime: 6,
    author: "Dr. Sarah Mitchell",
    date: "Mar 10, 2026",
  },
  {
    id: "2",
    title: "Separation Anxiety in Cats: Signs & Solutions",
    summary: "Cats can experience separation anxiety too. Discover the subtle signs you might be missing and effective strategies to ease your cat's stress when you leave home.",
    imageUrl: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=340&fit=crop",
    category: "Anxiety",
    readTime: 5,
    author: "Dr. Emily Carter",
    date: "Mar 5, 2026",
  },
  {
    id: "3",
    title: "Fireworks Season: A Survival Guide for Pet Owners",
    summary: "From noise-canceling techniques to calming supplements, here's everything you need to prepare your pet for fireworks season and keep them safe and relaxed.",
    imageUrl: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&h=340&fit=crop",
    category: "Phobias",
    readTime: 7,
    author: "Mark Thompson",
    date: "Feb 28, 2026",
  },
  {
    id: "4",
    title: "Desensitization Training: A Step-by-Step Approach",
    summary: "Gradual exposure therapy is one of the most effective ways to help fearful pets. Follow this structured guide to safely introduce your pet to their triggers.",
    imageUrl: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&h=340&fit=crop",
    category: "Training",
    readTime: 8,
    author: "Lisa Park, CPDT-KA",
    date: "Feb 20, 2026",
  },
  {
    id: "5",
    title: "Understanding Fear Aggression in Rescue Dogs",
    summary: "Rescue dogs often carry trauma that manifests as fear aggression. Learn to recognize the warning signs and build trust through patience and positive reinforcement.",
    imageUrl: "https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=600&h=340&fit=crop",
    category: "Training",
    readTime: 6,
    author: "Dr. James Rivera",
    date: "Feb 14, 2026",
  },
  {
    id: "6",
    title: "Calming Products That Actually Work for Anxious Pets",
    summary: "With so many calming products on the market, which ones are backed by science? We review supplements, pheromone diffusers, anxiety wraps, and more.",
    imageUrl: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&h=340&fit=crop",
    category: "Wellness",
    readTime: 5,
    author: "Dr. Sarah Mitchell",
    date: "Feb 8, 2026",
  },
  {
    id: "7",
    title: "Why Your Puppy Is Afraid of Everything (And How to Help)",
    summary: "Fear periods are a normal part of puppy development. Understanding these stages helps you guide your pup through them without reinforcing fearful behaviors.",
    imageUrl: "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=600&h=340&fit=crop",
    category: "Phobias",
    readTime: 4,
    author: "Lisa Park, CPDT-KA",
    date: "Jan 30, 2026",
  },
  {
    id: "8",
    title: "Meditation and Mindfulness: Calming Techniques for You and Your Pet",
    summary: "Pets mirror our energy. Explore how practicing mindfulness and breathing exercises can directly reduce your pet's anxiety levels alongside your own.",
    imageUrl: "https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&h=340&fit=crop",
    category: "Wellness",
    readTime: 5,
    author: "Dr. Emily Carter",
    date: "Jan 22, 2026",
  },
];

export default function FearFreedPage() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return DUMMY_POSTS;
    const q = search.toLowerCase();
    return DUMMY_POSTS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto flex items-center h-14 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex items-center gap-2 ml-3">
            <ShieldOff className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold font-display text-foreground">FearFreed™</span>
          </div>
        </div>
      </header>

      <main className={`max-w-5xl mx-auto ${isMobile ? "px-3 py-4 pb-24" : "px-6 py-6"}`}>
        {/* Hero */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 mb-6 text-center">
          <h1 className="text-2xl font-bold font-display text-foreground">Overcome Fear, Anxiety & Phobias</h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-lg mx-auto">
            Expert-backed guides to help pets and their owners conquer fears — one step at a time.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className={`grid gap-5 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
            {filtered.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <ShieldOff className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground">No articles found</h2>
            <p className="text-muted-foreground text-sm mt-1">Try a different search term.</p>
          </div>
        )}
      </main>
    </div>
  );
}
