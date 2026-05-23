import { AdminLayout } from "@/components/AdminLayout";
import { AdminPasswordGate } from "@/components/AdminPasswordGate";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Practice Commons — Admin",
};

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return <AdminPasswordGate />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}
