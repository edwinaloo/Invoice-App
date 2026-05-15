import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { getClients } from "../api/clients";
import { createInvoice, getInvoice, updateInvoice } from "../api/invoices";
import type { Client, CreateInvoicePayload } from "../types";
import { format } from "date-fns";

type FormValues = {
  client_id: number;
  issue_date: string;
  due_date: string;
  notes: string;
  tax_rate: number;
  items: { description: string; quantity: number; unit_price: number }[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function InvoiceForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      client_id: 0,
      issue_date: format(new Date(), "yyyy-MM-dd"),
      due_date: format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"),
      notes: "",
      tax_rate: 0,
      items: [{ description: "", quantity: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const watchedTaxRate = watch("tax_rate");

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  );
  const taxAmount = subtotal * ((Number(watchedTaxRate) || 0) / 100);
  const total = subtotal + taxAmount;

  useEffect(() => {
    getClients().then(setClients);
    if (isEditing) {
      getInvoice(Number(id))
        .then((inv) => {
          reset({
            client_id: inv.client_id,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            notes: inv.notes ?? "",
            tax_rate: inv.tax_rate,
            items:
              inv.items?.map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unit_price: i.unit_price,
              })) ?? [],
          });
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEditing, reset]);

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    try {
      const payload: CreateInvoicePayload = {
        client_id: Number(data.client_id),
        issue_date: data.issue_date,
        due_date: data.due_date,
        notes: data.notes,
        tax_rate: Number(data.tax_rate),
        items: data.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        })),
      };
      if (isEditing) {
        await updateInvoice(Number(id), payload);
        navigate(`/invoices/${id}`);
      } else {
        const inv = await createInvoice(payload);
        navigate(`/invoices/${inv.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/invoices" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to Invoices
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {isEditing ? "Edit Invoice" : "New Invoice"}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Details</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              {...register("client_id", { required: "Client is required", validate: (v) => Number(v) > 0 || "Select a client" })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value={0}>Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` — ${c.company}` : ""}
                </option>
              ))}
            </select>
            {errors.client_id && (
              <p className="text-red-500 text-xs mt-1">{errors.client_id.message}</p>
            )}
            {clients.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                No clients yet.{" "}
                <Link to="/clients" className="text-brand-600 hover:underline">
                  Add one first.
                </Link>
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
              <input
                type="date"
                {...register("issue_date", { required: true })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                {...register("due_date", { required: true })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register("tax_rate")}
              className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Line Items
          </h2>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    placeholder="Description"
                    {...register(`items.${index}.description`, { required: true })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Qty"
                    {...register(`items.${index}.quantity`, { min: 0 })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit Price"
                    {...register(`items.${index}.unit_price`, { min: 0 })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="w-24 pt-2 text-right text-sm text-gray-600 font-medium">
                  {fmt(
                    (Number(watchedItems[index]?.quantity) || 0) *
                      (Number(watchedItems[index]?.unit_price) || 0)
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  className="pt-2 text-red-400 hover:text-red-600 disabled:opacity-30 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => append({ description: "", quantity: 1, unit_price: 0 })}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            + Add Line Item
          </button>

          <div className="border-t border-gray-100 pt-4 flex justify-end">
            <div className="w-56 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Tax ({watchedTaxRate}%)</span>
                <span>{fmt(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-base text-brand-600 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            rows={3}
            {...register("notes")}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            placeholder="Payment terms, bank details, thank you note…"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link
            to="/invoices"
            className="border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
          >
            {saving ? "Saving…" : isEditing ? "Update Invoice" : "Create Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
