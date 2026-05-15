export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  created_at: string;
  invoice_count: number;
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  client: Client;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  notes?: string;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  items?: InvoiceItem[];
  payment_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_revenue: number;
  pending_amount: number;
  overdue_amount: number;
  total_clients: number;
  total_invoices: number;
  by_status: Record<InvoiceStatus, number>;
  recent_invoices: Invoice[];
}

export interface CreateClientPayload {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
}

export interface BusinessProfile {
  business_name: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  logo_url: string;
  default_tax_rate: number;
  currency: string;
}

export interface RevenueChartPoint {
  month: string;
  label: string;
  revenue: number;
  invoice_count: number;
}

export interface CreateInvoicePayload {
  client_id: number;
  issue_date: string;
  due_date: string;
  notes?: string;
  tax_rate: number;
  items: Omit<InvoiceItem, "id" | "invoice_id" | "amount">[];
}
