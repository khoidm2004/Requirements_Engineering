import type { Picture } from '../lib/types';

export function PictureView({ picture, alt }: { picture: Picture; alt: string }) {
  if ('emoji' in picture) {
    return (
      <span className="picture picture--emoji" role="img" aria-label={alt}>
        {picture.emoji}
      </span>
    );
  }
  return <img className="picture" src={`/api/images/${picture.imageId}`} alt={alt} loading="lazy" />;
}
