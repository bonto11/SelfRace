import BillingPanel from "@/app/features/billing/components/BillingPanel";

export const metadata = {
  title: "Account & Billing",
};

export default function AccountPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Account & Billing</h1>
        <p className="mt-1 text-sm opacity-70">
          Sprav svoje subscription tiers a AI limity. Zatiaľ je to DEV
          obrazovka s manuálnym prepínaním tierov.
        </p>
      </header>

      <BillingPanel />
    </main>
  );
}