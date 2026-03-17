import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface BlogPost {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  category: string;
  readTime: number;
  author: string;
  date: string;
}

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Card className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
      <div className="aspect-video overflow-hidden">
        <img
          src={post.imageUrl}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">{post.category}</Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {post.readTime} min read
          </span>
        </div>
        <h3 className="font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{post.summary}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">{post.date}</span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-primary"
            onClick={() =>
              toast({ title: "Coming Soon", description: "Full articles will be available soon!" })
            }
          >
            Read More <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
