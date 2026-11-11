import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/session-context";
import ToastBanner from "@/components/ToastBanner";

export const metadata: Metadata = {
  title: "ReconCore | Operational Reconciliation & Verifiable Skill Credentials",
  description:
    "Reconcile messy AI-generated company spreadsheets, get graded by deterministic code, and mint an Ed25519-signed W3C Open Badges 3.0 credential.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased">
        <SessionProvider>
          <ToastBanner />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
