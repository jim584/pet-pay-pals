import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'];

export function isValidImageFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ALLOWED_IMAGE_EXTENSIONS.includes(ext);
}

export const ACCEPTED_IMAGE_TYPES = ALLOWED_IMAGE_EXTENSIONS.map(e => `.${e}`).join(',');
