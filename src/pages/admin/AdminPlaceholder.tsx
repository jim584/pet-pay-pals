import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardContent className="py-12 text-center">
          <Construction className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-1">{title}</h2>
          <p className="text-sm text-muted-foreground">
            This admin module is part of an upcoming phase. Coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
