import Link from "next/link";
import { Brand } from "@/components/ui/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center" aria-label="Cowork home">
          <Brand />
        </Link>
        {children}
        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          In-room activity is temporary: chat is not stored, and profile fields
          you write are visible to other members.
        </p>
      </div>
    </div>
  );
}
