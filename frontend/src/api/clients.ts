import api from "./index";
import type { Client, CreateClientPayload } from "../types";

export const getClients = () => api.get<Client[]>("/clients").then((r) => r.data);

export const getClient = (id: number) =>
  api.get<Client>(`/clients/${id}`).then((r) => r.data);

export const createClient = (payload: CreateClientPayload) =>
  api.post<Client>("/clients", payload).then((r) => r.data);

export const updateClient = (id: number, payload: Partial<CreateClientPayload>) =>
  api.put<Client>(`/clients/${id}`, payload).then((r) => r.data);

export const deleteClient = (id: number) =>
  api.delete(`/clients/${id}`).then((r) => r.data);
