import { friendenzaDemoSvg } from "@/lib/generative/demo";

export const size = { width: 512, height: 512 };
export const contentType = "image/svg+xml";

export default function Icon() {
  return new Response(friendenzaDemoSvg, {
    headers: { "Content-Type": contentType },
  });
}
