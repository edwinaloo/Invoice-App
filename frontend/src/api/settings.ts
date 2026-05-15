import api from "./index";
import type { BusinessProfile } from "../types";

export const getSettings = () =>
  api.get<BusinessProfile>("/settings").then((r) => r.data);

export const updateSettings = (payload: Partial<BusinessProfile>) =>
  api.put<BusinessProfile>("/settings", payload).then((r) => r.data);
