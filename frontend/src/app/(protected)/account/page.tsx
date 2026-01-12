import PersonalSettingsPanel from "@/app/features/account/components/PersonalSettingsPanel";
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
          Sprav svoje osobné nastavenia účtu, subscription tiers a AI limity.
        </p>
      </header>

      {/* nový panel */}
      <PersonalSettingsPanel />

      {/* existujúci BillingPanel */}
      <BillingPanel />
    </main>
  );
}