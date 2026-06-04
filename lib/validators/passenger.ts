import { z } from "zod";

export const ReservationEntrySchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요.").max(50),
  phoneLast4: z
    .string()
    .min(4, "전화번호 끝 4자리를 입력해 주세요.")
    .max(4, "전화번호 끝 4자리를 입력해 주세요.")
    .regex(/^\d{4}$/, "숫자 4자리를 입력해 주세요."),
});

export type ReservationEntryInput = z.infer<typeof ReservationEntrySchema>;

export const CancelReasonSchema = z.object({
  reason: z.string().max(200).optional(),
});

export type CancelReasonInput = z.infer<typeof CancelReasonSchema>;
