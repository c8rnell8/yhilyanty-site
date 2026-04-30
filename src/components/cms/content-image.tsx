import Image from "next/image";

import { readImageOverrides } from "@/lib/cms/store";

/** <ContentImage> — server component that resolves to the admin-uploaded
 *  override for `slot` or falls back to `src`. Pass it like a normal next/image
 *  with all the standard props.
 */
export async function ContentImage({
  slot,
  src,
  alt,
  width,
  height,
  className,
  fill,
  sizes,
  priority,
}: {
  slot: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
}) {
  let resolved = src;
  try {
    const overrides = await readImageOverrides();
    if (overrides[slot]) resolved = overrides[slot];
  } catch {
    /* fall back to src */
  }

  // Use unoptimized for our /api/cms/images/* paths so Next doesn't try
  // to optimize them through the standard image pipeline.
  const unoptimized = resolved.startsWith("/api/cms/images/");

  if (fill) {
    return (
      <Image
        src={resolved}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
        unoptimized={unoptimized}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      width={width || 800}
      height={height || 800}
      sizes={sizes}
      className={className}
      priority={priority}
      unoptimized={unoptimized}
    />
  );
}
