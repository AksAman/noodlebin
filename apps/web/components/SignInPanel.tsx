import { SignInButtons } from "@/components/SignInButtons";
import { cn, docShell } from "@/lib/ui";

export function SignInPanel() {
  return (
    <div
      className={cn(
        docShell,
        "min-h-[calc(100dvh-35rem)] md:min-h-[calc(100dvh-10rem)] w-full justify-center px-5 py-16 sm:px-8",
      )}
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-20">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[clamp(2.75rem,1.8rem+3vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
            Sign in
          </h1>
          <p className="mt-4 max-w-[36ch] text-[17px] leading-relaxed text-muted">
            Optional. A handle is how graphs are credited to you. You can keep
            publishing without one.
          </p>
        </div>
        <div className="min-w-0 w-full">
          <SignInButtons callbackURL="/account" />
        </div>
      </div>
    </div>
  );
}
