import { FurensicLibrary } from "@/components/furensic/FurensicLibrary";

export default function AdminFurensicPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Furensic Files</h1>
        <p className="text-sm text-muted-foreground">
          Manage blog posts, videos, and podcast episodes. Pasted YouTube links play inside the app.
        </p>
      </div>
      <FurensicLibrary includeDrafts />
    </div>
  );
}
