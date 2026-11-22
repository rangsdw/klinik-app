import { apiRequireRole } from "@/lib/rbac";
import { getPatientLiveQueueData } from "@/features/appointments/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await apiRequireRole("PATIENT");
  if (auth.response) return auth.response;

  const payload = await getPatientLiveQueueData(auth.user.id);
  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
