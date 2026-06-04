import { verifyEntry } from "./actions";
import { ReservationForm } from "@/components/passenger/ReservationForm";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function ReservationEntryPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { error } = await searchParams;

  const action = verifyEntry.bind(null, code);

  return <ReservationForm code={code} error={error} action={action} />;
}
