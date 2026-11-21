import { SmartLinkEditor } from "@/app/components/smart-link-editor";
import { SmartLinksShell } from "@/app/components/smart-links-shell";

export default function SmartLinkEditorPage() {
  return <SmartLinksShell><SmartLinkEditor mode="edit" /></SmartLinksShell>;
}
