import { env } from "$env/dynamic/private";
import OpenAI from "openai";
import type { ReplyInput } from "../reply";
import { buildReplyMessages } from "./prompts/reply";

export async function generateReply(input: ReplyInput): Promise<string> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: 30_000,
    maxRetries: 0,
  });
  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: buildReplyMessages(input),
    max_completion_tokens: 1200,
  });

  const choice = completion.choices[0];
  const draft = choice?.message.content;
  if (choice?.finish_reason !== "stop" || !draft?.trim()) {
    throw new Error("The model did not return a complete reply.");
  }
  return draft;
}
