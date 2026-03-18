import { AspectRatio } from "@/components/ui/aspect-ratio";

interface PhotoGridProps {
  photos: string[];
  alt?: string;
  onImageClick?: (url: string) => void;
  maxHeight?: string;
}

export function PhotoGrid({ photos, alt = "", onImageClick, maxHeight = "max-h-96" }: PhotoGridProps) {
  const count = photos.length;
  if (count === 0) return null;

  const handleClick = (url: string) => onImageClick?.(url);

  if (count === 1) {
    return (
      <AspectRatio ratio={4 / 3}>
        <img
          src={photos[0]}
          alt={alt}
          className="object-cover w-full h-full cursor-pointer transition-opacity hover:opacity-90"
          loading="lazy"
          onClick={() => handleClick(photos[0])}
        />
      </AspectRatio>
    );
  }

  if (count === 2) {
    return (
      <div className={`grid grid-cols-2 gap-0.5 ${maxHeight} overflow-hidden`}>
        {photos.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`${alt} - ${i + 1}`}
            className="object-cover w-full h-full cursor-pointer transition-opacity hover:opacity-90"
            loading="lazy"
            onClick={() => handleClick(url)}
          />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 ${maxHeight} overflow-hidden`}>
        <img
          src={photos[0]}
          alt={`${alt} - 1`}
          className="object-cover w-full h-full row-span-2 cursor-pointer transition-opacity hover:opacity-90"
          loading="lazy"
          onClick={() => handleClick(photos[0])}
        />
        <img
          src={photos[1]}
          alt={`${alt} - 2`}
          className="object-cover w-full h-full cursor-pointer transition-opacity hover:opacity-90"
          loading="lazy"
          onClick={() => handleClick(photos[1])}
        />
        <img
          src={photos[2]}
          alt={`${alt} - 3`}
          className="object-cover w-full h-full cursor-pointer transition-opacity hover:opacity-90"
          loading="lazy"
          onClick={() => handleClick(photos[2])}
        />
      </div>
    );
  }

  // 4+ photos: 2x2 grid, "+N" overlay on last cell if >4
  const displayPhotos = photos.slice(0, 4);
  const remaining = count - 4;

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-0.5 ${maxHeight} overflow-hidden`}>
      {displayPhotos.map((url, i) => (
        <div key={i} className="relative overflow-hidden">
          <img
            src={url}
            alt={`${alt} - ${i + 1}`}
            className="object-cover w-full h-full cursor-pointer transition-opacity hover:opacity-90"
            loading="lazy"
            onClick={() => handleClick(url)}
          />
          {i === 3 && remaining > 0 && (
            <div
              className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer"
              onClick={() => handleClick(url)}
            >
              <span className="text-white text-2xl font-bold">+{remaining}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
