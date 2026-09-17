export const toneLabels = {
  concise: 'Concise',
  friendly: 'Friendly',
  formal: 'Formal',
} as const;

export type Tone = keyof typeof toneLabels;

export interface ReplyInput {
  message: string;
  context: string;
  tone: Tone;
}

export const inputLimits = { message: 6000, context: 4000 } as const;
