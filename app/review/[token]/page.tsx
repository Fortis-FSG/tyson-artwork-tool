import { CustomerReview } from "@/components/CustomerReview";

interface ReviewPageProps {
  params: Promise<{ token: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { token } = await params;
  return <CustomerReview token={token} />;
}
