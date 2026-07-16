"use client";

import { use } from "react";

import { RequestLoader } from "@/components/RequestLoader";

interface RequestPageProps {
  params: Promise<{ id: string }>;
}

export default function RequestPage({ params }: RequestPageProps) {
  const { id } = use(params);
  return <RequestLoader id={id} />;
}
