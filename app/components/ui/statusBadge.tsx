import React from "react";
import { twMerge } from "tailwind-merge";
import type { RecordingStatus } from "~/utils/db.server";

type StatusBadgeProps = {
  status: RecordingStatus;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  let badgeClassName: string = "";

  switch (status) {
    case "completed":
      badgeClassName = "badge-success";
      break;
    case "failed":
      badgeClassName = "badge-error";
      break;
    case "pending":
      badgeClassName = "badge-primary";
      break;
    case "cancelled":
      badgeClassName = "badge-warning";
      break;
    default:
      break;
  }

  return (
    <div className={twMerge("badge badge-soft badge-outline", badgeClassName)}>
      {status}
    </div>
  );
}
