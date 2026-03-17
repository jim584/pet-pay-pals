import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createVettedProduct } from "@/lib/vetted-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = [
  { value: "food", label: "Food" },
  { value: "toys", label: "Toys" },
  { value: "health", label: "Health" },
  { value: "accessories", label: "Accessories" },
  { value: "general", label: "General" },
];

export function CreateProductDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    image_url: "",
    price_text: "",
    external_url: "",
    store_name: "",
    category: "general",
  });

  const mutation = useMutation({
    mutationFn: () =>
      createVettedProduct({ ...form, listed_by: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vetted-products"] });
      setOpen(false);
      setForm({ name: "", description: "", image_url: "", price_text: "", external_url: "", store_name: "", category: "general" });
      toast({ title: "Product listed successfully!" });
    },
    onError: () => toast({ title: "Failed to list product", variant: "destructive" }),
  });

  const canSubmit = form.name.trim() && form.external_url.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> List Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List a Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Product Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Premium Dog Food" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief product description..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price (display)</Label>
              <Input value={form.price_text} onChange={(e) => setForm({ ...form, price_text: e.target.value })} placeholder="$29.99" />
            </div>
            <div className="space-y-1.5">
              <Label>Store Name</Label>
              <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} placeholder="Amazon" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>External URL *</Label>
            <Input value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://amazon.com/product/..." />
          </div>
          <div className="space-y-1.5">
            <Label>Image URL</Label>
            <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Listing..." : "List Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
