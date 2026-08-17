import type { VettedProduct } from "@/lib/vetted-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BadgeCheck, ExternalLink, Store } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface ProductCardProps {
  product: VettedProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <AspectRatio ratio={1}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Store className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
      </AspectRatio>
      <CardContent className="p-3 space-y-2">
        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 border-primary/40 text-primary">
          <BadgeCheck className="h-3 w-3" /> Vetted-approved
        </Badge>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">
            {product.name}
          </h3>
          {product.price_text && (
            <span className="text-sm font-bold text-primary whitespace-nowrap">
              {product.price_text}
            </span>
          )}
        </div>

        {product.brand && (
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{product.brand}</p>
        )}

        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {product.store_name && (
            <Badge variant="secondary" className="text-xs truncate max-w-[120px]">
              {product.store_name}
            </Badge>
          )}
          <Button size="sm" className="ml-auto gap-1 text-xs" asChild>
            <a
              href={product.external_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Shop Now <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
