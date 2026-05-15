import api from "./index";
import type { Invoice, InvoiceStatus, CreateInvoicePayload, DashboardStats } from "../types";

export const getInvoices = (status?: InvoiceStatus) =>
  api.get<Invoice[]>("/invoices", { params: status ? { status } : {} }).then((r) => r.data);

export const getInvoice = (id: number) =>
  api.get<Invoice>(`/invoices/${id}`).then((r) => r.data);

export const createInvoice = (payload: CreateInvoicePayload) =>
  api.post<Invoice>("/invoices", payload).then((r) => r.data);

export const updateInvoice = (id: number, payload: Partial<CreateInvoicePayload>) =>
  api.put<Invoice>(`/invoices/${id}`, payload).then((r) => r.data);

export const updateInvoiceStatus = (id: number, status: InvoiceStatus) =>
  api.patch<Invoice>(`/invoices/${id}/status`, { status }).then((r) => r.data);

export const deleteInvoice = (id: number) =>
  api.delete(`/invoices/${id}`).then((r) => r.data);

export const downloadInvoicePdf = async (id: number, filename: string) => {
  const response = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const createCheckoutSession = (id: number) =>
  api.post<{ url: string; reference: string }>(`/invoices/${id}/checkout-session`).then((r) => r.data);

export const verifyPayment = (id: number, reference: string) =>
  api.post<{ paid: boolean; invoice?: Invoice; status?: string }>(`/invoices/${id}/verify-payment`, { reference }).then((r) => r.data);

export const sendInvoiceEmail = (id: number) =>
  api.post<{ message: string }>(`/invoices/${id}/send-email`).then((r) => r.data);

export const shareInvoice = (id: number) =>
  api.post<{ token: string; url: string }>(`/invoices/${id}/share`).then((r) => r.data);

export const getRevenueChart = () =>
  api.get("/dashboard/revenue-chart").then((r) => r.data);

export const getDashboardStats = () =>
  api.get<DashboardStats>("/dashboard/stats").then((r) => r.data);

