// src/app/(protected)/coach/page.tsx
import ClientPage from "./ClientPage";

export const metadata = { title: "Coach" };

export default function Page() {
  return <ClientPage />; // nič iné – žiadne hooky ani client importy
}