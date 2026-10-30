import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import EmailTrackerGenerator from "@/components/EmailTrackerGenerator";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmailTrackerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email?.toLowerCase().endsWith("@renewlighting.com")) {
    redirect("/employee?callbackUrl=/email-tracker");
  }

  return <EmailTrackerGenerator />;
}
