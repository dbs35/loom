import type { Metadata } from "next";

import "../styles/globals.css";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Practice Commons",
  description:
    "A knowledge commons for the autism community — programs, papers, questions, and specialists, written down by the practitioners who do the work.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink font-body">
        <TopBar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
