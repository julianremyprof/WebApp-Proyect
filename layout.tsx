import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProLearnin6",
  description: "Interactive English learning platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
