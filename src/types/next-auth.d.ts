import type { DefaultSession } from "next-auth";
import type { RoleName, StaffTypeName } from "@/lib/roles";

declare module "next-auth" {
  interface User {
    role: RoleName;
    staffType?: StaffTypeName | null;
    remember?: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: RoleName;
      staffType: StaffTypeName | null;
      name: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: RoleName;
    staffType: StaffTypeName | null;
    sessionExpiresAt?: number;
  }
}
