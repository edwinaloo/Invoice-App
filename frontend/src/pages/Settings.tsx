import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { getSettings, updateSettings } from "../api/settings";
import type { BusinessProfile } from "../types";

const CURRENCIES = ["KES", "USD", "NGN", "GHS", "ZAR", "GBP", "EUR", "UGX", "TZS"];

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<BusinessProfile>();

  const watchedLogo = watch("logo_url");

  useEffect(() => {
    getSettings().then((data) => {
      reset(data);
      setLogoPreview(data.logo_url || "");
    });
  }, [reset]);

  useEffect(() => {
    setLogoPreview(watchedLogo || "");
  }, [watchedLogo]);

  const onSubmit = async (data: BusinessProfile) => {
    await updateSettings(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          This information appears on your invoices and emails.
        </p>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3 text-sm font-medium">
          ✓ Settings saved successfully
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Logo preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Brand
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Logo URL
            </label>
            <input
              type="url"
              {...register("logo_url")}
              placeholder="https://yoursite.com/logo.png"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Paste a direct link to your logo image (PNG or JPG). It will appear on PDFs.
            </p>
          </div>
          {logoPreview && (
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-12 object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <span className="text-xs text-gray-400">Logo preview</span>
            </div>
          )}
        </div>

        {/* Business info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Business Info
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name *
            </label>
            <input
              {...register("business_name", { required: true })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Mainstream Company"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Email
              </label>
              <input
                type="email"
                {...register("business_email")}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="billing@yourcompany.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Phone
              </label>
              <input
                {...register("business_phone")}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="+254 700 000 000"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Address
            </label>
            <textarea
              rows={2}
              {...register("business_address")}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Nairobi, Kenya"
            />
          </div>
        </div>

        {/* Defaults */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
            Invoice Defaults
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                {...register("currency")}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                {...register("default_tax_rate")}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Email setup hint */}
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-5 text-sm text-brand-700 space-y-1">
          <p className="font-semibold">📧 To enable Send Invoice email:</p>
          <p>
            Add your Gmail credentials to <code className="bg-brand-100 px-1 rounded">backend/.env</code>:
          </p>
          <pre className="bg-white border border-brand-100 rounded-lg p-3 text-xs text-gray-700 mt-2">
{`MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=your-app-password`}
          </pre>
          <p className="text-xs text-brand-600 mt-1">
            Use a Gmail App Password (not your regular password) — create one at
            myaccount.google.com → Security → 2-Step Verification → App passwords.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {isSubmitting ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
