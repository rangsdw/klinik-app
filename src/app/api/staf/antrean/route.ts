import { apiRequireRole } from "@/lib/rbac";
import { getStaffQueueBoardData } from "@/features/appointments/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await apiRequireRole("STAFF");
  if (auth.response) return auth.response;

  if (auth.user.staffType !== "REGISTRATION") {
    return Response.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const payload = await getStaffQueueBoardData();
  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
