import { Metadata } from "next";
import { SyncManager } from "@/components/account/sync-manager";

export const metadata: Metadata = {
  title: "Cloud Sync - 1two",
  description: "Manage cloud sync settings for your tools",
};

export default function SyncPage() {
  return <SyncManager />;
}
