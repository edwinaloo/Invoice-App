import api from "./index";
import type { User } from "../types";

interface AuthResponse {
  token: string;
  user: User;
}

export const register = (name: string, email: string, password: string) =>
  api.post<AuthResponse>("/auth/register", { name, email, password }).then((r) => r.data);

export const login = (email: string, password: string) =>
  api.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data);

export const getMe = () =>
  api.get<User>("/auth/me").then((r) => r.data);
