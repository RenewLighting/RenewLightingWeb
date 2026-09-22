import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import QuoteBuilder from "@/components/QuoteBuilder";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function QuotePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email?.toLowerCase().endsWith("@renewlighting.com")) {
    redirect("/employee?callbackUrl=/quote");
  }
  return <QuoteBuilder />;
}
