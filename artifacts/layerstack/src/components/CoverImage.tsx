import { useState } from "react";
import { Disc3 } from "lucide-react";
import { storageUrl, cn } from "@/lib/utils";

interface CoverImageProps {
  url: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: string;
}

export function CoverImage({ url, alt, className = "", iconSize = "w-8 h-8" }: CoverImageProps) {
  const [errored, setErrored] = useState(false);
  const showImage = !!url && !errored;

  if (showImage) {
    return (
      <img
        src={storageUrl(url)}
        alt={alt}
        className={cn("object-cover", className)}
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div className={cn("bg-secondary flex items-center justify-center", className)}>
      <Disc3 className={cn("text-muted-foreground", iconSize)} />
    </div>
  );
}
