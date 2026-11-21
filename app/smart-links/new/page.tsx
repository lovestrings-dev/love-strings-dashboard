import { SmartLinkEditor } from "@/app/components/smart-link-editor";
import { SmartLinksShell } from "@/app/components/smart-links-shell";

export default function NewSmartLinkPage() {
  return <SmartLinksShell><SmartLinkEditor mode="new" /></SmartLinksShell>;
}
