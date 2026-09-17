import { fail } from "@sveltejs/kit";
import { generateReply } from "$lib/server/generate-reply";
import { inputLimits, toneLabels, type ReplyInput, type Tone } from "$lib/reply";
import type { Actions } from "./$types";

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const message = data.get("message");
    const context = data.get("context") ?? "";
    const tone = data.get("tone");
    const validTone = typeof tone === "string" && Object.hasOwn(toneLabels, tone);
    const values = {
      message: typeof message === "string" ? message : "",
      context: typeof context === "string" ? context : "",
      tone: validTone ? (tone as Tone) : ("friendly" as const),
    };
    const errors: Partial<Record<keyof ReplyInput, string>> = {};

    if (!values.message.trim()) {
      errors.message = "Paste the customer’s message first.";
    } else if (values.message.length > inputLimits.message) {
      errors.message = `Keep the customer message under ${inputLimits.message} characters.`;
    }
    if (typeof context !== "string" || values.context.length > inputLimits.context) {
      errors.context = `Use text notes up to ${inputLimits.context} characters.`;
    }
    if (!validTone) errors.tone = "Choose one of the available tones.";
    if (Object.keys(errors).length) {
      return fail(400, { values, errors, error: null, draft: null });
    }

    try {
      const draft = await generateReply(values);
      return { values, errors, error: null, draft };
    } catch {
      return fail(502, {
        values,
        errors,
        draft: null,
        error: "We couldn’t generate a reply. Your notes are still here — please try again.",
      });
    }
  },
} satisfies Actions;
