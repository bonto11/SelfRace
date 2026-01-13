import StravaPanel from "@/app/features/connectedApps/components/StravaPanel";

export const metadata = {
  title: "Connected apps",
};

export default function ConnectedAppsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Connected apps</h1>
        <p className="mt-1 text-sm opacity-70">
          Prepojenie so Stravou a ďalšími službami. Tu vieš spravovať
          pripojenie a import tréningov.
        </p>
      </header>

      <StravaPanel />
    </main>
  );
}