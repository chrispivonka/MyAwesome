import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">MyAwesome</h1>
      <p className="max-w-lg text-lg text-muted-foreground">
        An AI-powered curator that transforms GitHub Awesome Lists and new
        tech releases into your own personalized discovery feed.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/dashboard" });
        }}
      >
        <Button type="submit" size="lg">
          Sign in with GitHub
        </Button>
      </form>
    </div>
  );
}
