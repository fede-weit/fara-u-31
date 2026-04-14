/**
 * Optional equirectangular globe surface (2:1 width:height, JPG/PNG/WebP).
 * Place the file under `public/` and set the path (leading slash = site root).
 * Example: `/assets/images/globe/relata-surface.jpg`
 * Leave null to use the built-in procedural texture.
 */
export const GLOBE_CUSTOM_EQUIRECTANGULAR_URL: string | null =
  '/assets/images/world-equirectangular.png';

/** Optional height/bump map in the same equirectangular layout. */
export const GLOBE_CUSTOM_BUMP_URL: string | null = null;
