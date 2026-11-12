import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combines conditional class names with `clsx` and resolves Tailwind utility conflicts via `tailwind-merge`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
