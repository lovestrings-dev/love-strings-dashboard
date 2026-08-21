"use client";

import { useRouter } from "next/navigation";
import { PlatformAdministrationView } from "../platform-administration-view";

export default function PlatformAdministrationPage() {
  const router = useRouter();
  return <PlatformAdministrationView activeSection="Platform administration" onBack={() => router.replace("/no-workspace")} showBack />;
}
