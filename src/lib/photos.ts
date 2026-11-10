/** Free photos from Unsplash, served from their CDN as the Unsplash License allows. Replace with photos from real jobs when there are some. */
export interface Photo {
  id: string;
  alt: string;
  author: string;
}

export const PHOTOS = {
  hero: { id: "1721825157088-1cf9e64ddba5", alt: "", author: "Alex Tyson" },
  bath: { id: "1733426107854-ee00a25d72a7", alt: "Ljust badrum med fristående badkar och stort fönster", author: "Murad Kerimli" },
  kitchen: { id: "1764080582659-652c0000ff1d", alt: "Kök i trä med matbord och mjukt ljus", author: "Poojan Thanekar" },
  el: { id: "1758101755915-462eddc23f57", alt: "Elektriker mäter i en elcentral", author: "Toolmash Expo" },
  craft: { id: "1659930087003-2d64e33181f7", alt: "Hantverkare som märker upp en bräda med blyerts", author: "Craft Kitties" },
} satisfies Record<string, Photo>;

export function photoUrl(photo: Photo, width: number): string {
  return `https://images.unsplash.com/photo-${photo.id}?auto=format&fit=crop&w=${width}&q=70`;
}

export function photoSrcSet(photo: Photo, widths: number[]): string {
  return widths.map((w) => `${photoUrl(photo, w)} ${w}w`).join(", ");
}
