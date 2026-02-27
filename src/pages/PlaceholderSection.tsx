import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";

export default function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8 text-center">
      <Construction className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-3xl font-bold font-display text-foreground">{title}</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        This section is coming soon. We're building something special for pets and their people.
      </p>
      <Button variant="outline" className="mt-6 gap-2" asChild>
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Feed</Link>
      </Button>
    </div>
  );
}
