import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getProfileForAccessToken } from "./profile.server";

export const getMyProfile = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => getProfileForAccessToken(data.accessToken));