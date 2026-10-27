import { z } from "zod";

export const Salud = z
  .strictObject({
    estado: z.literal("ok"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  })
  .meta({ title: "Salud" });

export type Salud = z.infer<typeof Salud>;
