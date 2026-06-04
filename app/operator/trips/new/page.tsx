import { requireOperator } from "@/lib/auth/operator";
import { createClient } from "@/lib/supabase/server";
import { TripNewForm } from "./TripNewForm";

export default async function Page() {
  const session = await requireOperator();
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("region_locations")
    .select("id, direction, location_type, address, label")
    .eq("region_id", session.regionId!)
    .order("is_default", { ascending: false });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold">새 Trip 등록</h1>
      <TripNewForm locations={locations ?? []} />
    </div>
  );
}
