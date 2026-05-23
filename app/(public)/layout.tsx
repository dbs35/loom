import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
