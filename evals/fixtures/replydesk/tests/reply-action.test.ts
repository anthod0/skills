import { beforeEach, describe, expect, it, vi } from "vitest";
import { isActionFailure } from "@sveltejs/kit";
import { generateReply } from "$lib/server/generate-reply";
import { actions } from "../src/routes/+page.server";

vi.mock("$lib/server/generate-reply", () => ({ generateReply: vi.fn() }));

const fields = {
  message: "Where is order #1042?",
  context: "The carrier expects delivery on Friday.",
  tone: "friendly",
};

async function submit(values = fields) {
  const request = new Request("http://localhost/", {
    method: "POST",
    body: new URLSearchParams(values),
  });
  return actions.default({ request } as Parameters<typeof actions.default>[0]);
}

beforeEach(() => vi.mocked(generateReply).mockReset());

describe("reply submission", () => {
  it.each([
    { ...fields, message: " \n " },
    { ...fields, message: "a".repeat(6001) },
    { ...fields, context: "a".repeat(4001) },
    { ...fields, tone: "invented-tone" },
  ])("rejects invalid input before contacting the model", async (values) => {
    const result = await submit(values);
    expect(isActionFailure(result)).toBe(true);
    if (!isActionFailure(result)) throw new Error("Expected a validation failure");
    expect(result.status).toBe(400);
    expect(Object.keys(result.data.errors).length).toBeGreaterThan(0);
    expect(generateReply).not.toHaveBeenCalled();
  });

  it("returns the generated draft and retains the form values", async () => {
    const draft = "Your parcel is expected on Friday.\nThanks for your patience.";
    vi.mocked(generateReply).mockResolvedValueOnce(draft);
    const result = await submit();
    expect(isActionFailure(result)).toBe(false);
    if (isActionFailure(result)) throw new Error("Expected a successful draft");
    expect(result.draft).toBe(draft);
    expect(result.values).toEqual(fields);
  });

  it("preserves input after a provider failure and allows a new attempt", async () => {
    vi.mocked(generateReply)
      .mockRejectedValueOnce(new Error("Provider timeout: private diagnostic"))
      .mockResolvedValueOnce("Your parcel is expected on Friday.");
    const failed = await submit();
    expect(isActionFailure(failed)).toBe(true);
    if (!isActionFailure(failed)) throw new Error("Expected a provider failure");
    expect(failed.status).toBe(502);
    expect(failed.data.values).toEqual(fields);
    expect(failed.data.error).toBeTruthy();
    expect(failed.data.error).toContain("please try again");
    expect(JSON.stringify(failed.data)).not.toContain("private diagnostic");

    const retried = await submit();
    expect(isActionFailure(retried)).toBe(false);
    if (isActionFailure(retried)) throw new Error("Expected the retry to succeed");
    expect(retried.draft).toBe("Your parcel is expected on Friday.");
    expect(retried.error).toBeNull();
  });
});
