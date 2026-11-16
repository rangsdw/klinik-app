import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/features/auth/schemas";
import { findUserByIdentifier } from "@/features/auth/queries";

let _dummy: string | undefined;
function dummyHash() {
  return (_dummy ??= bcrypt.hashSync("dummy-password-for-timing", 12));
}

export class InactiveAccountError extends CredentialsSignin {
  code = "inactive";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Email atau No. HP" },
        password: { label: "Password", type: "password" },
        remember: { label: "Ingat saya" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { identifier, password, remember } = parsed.data;

        const user = await findUserByIdentifier(identifier);
        // Tetap jalankan bcrypt agar waktu respons tidak membocorkan apakah akun ada.
        const hash = user?.passwordHash ?? dummyHash();
        const valid = await bcrypt.compare(password, hash);
        if (!user || !valid) return null;
        if (!user.isActive) throw new InactiveAccountError();

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          staffType: user.staffType,
          remember,
        };
      },
    }),
  ],
});
