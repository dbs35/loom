import type { Metadata } from "next";

import "../styles/globals.css";

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
      <body className="bg-bg text-ink font-body">{children}</body>
    </html>
  );
}
