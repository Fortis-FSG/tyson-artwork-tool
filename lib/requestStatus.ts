import type { RequestStatus } from "@/types";

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Draft",
  awaiting_customer: "Awaiting customer",
  customer_approved: "Customer approved",
  handed_off: "Handed off",
};

export function statusBadgeVariant(
  status: RequestStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "customer_approved":
      return "default";
    case "awaiting_customer":
      return "secondary";
    case "handed_off":
      return "outline";
    default:
      return "outline";
  }
}
