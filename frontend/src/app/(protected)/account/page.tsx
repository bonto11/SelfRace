import PersonalSettingsPanel from "@/app/features/account/components/PersonalSettingsPanel";
import BillingPanel from "@/app/features/billing/components/BillingPanel";

export const metadata = {
  title: "Account & Settings",
};

export default function AccountPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Account & Settings</h1>
        <p className="mt-1 text-sm opacity-70">
          Nastav si účet, preferencie aplikácie a sprav svoje subscription tiers
          a AI limity.
        </p>
      </header>

      <div className="space-y-4">
        <PersonalSettingsPanel />
        <BillingPanel />
      </div>
    </main>
  );
}