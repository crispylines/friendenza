import { describe, expect, it } from "vitest";
import Icon from "./icon";
import { friendenzaDemoSvg } from "@/lib/generative/demo";

describe("site icon", () => {
  it("serves the exact V4 artwork used by the homepage example", async () => {
    const response = Icon();

    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    await expect(response.text()).resolves.toBe(friendenzaDemoSvg);
  });
});
