import { redirect } from "next/navigation";

// Keep saved links working; setup now lives on the customer overview.
export default function SetupPage() {
  redirect("/dashboard#setup");
}
