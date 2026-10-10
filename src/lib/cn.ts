import { extendTailwindMerge } from "tailwind-merge";

/** Knows the project's custom theme tokens so overrides like `shadow-float` replace `shadow-card`. */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ["card", "float"],
      font: ["sans", "mono", "display"],
    },
  },
});

/** Join class names; later Tailwind utilities win over earlier conflicting ones. */
export function cn(...parts: (string | false | null | undefined)[]) {
  return merge(parts.filter(Boolean).join(" "));
}
