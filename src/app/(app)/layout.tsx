export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <Link href="/dashboard" className="font-bold text-lg">Taktik-Drill</Link>
        <Link href="/sets" className="text-gray-400 hover:text-white text-sm">Sets</Link>
        <Link href="/puzzles" className="text-gray-400 hover:text-white text-sm">Aufgaben</Link>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </nav>
      <main className="flex-1 p-3 sm:p-6">{children}</main>
    </div>
  );
}
