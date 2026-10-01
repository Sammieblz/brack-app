import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getReaderSignInPath } from "@/services/authReturnIntent";

export function ReaderSignInPrompt({ destination, title, description }: { destination: string; title: string; description: string }) {
  return (
    <section className="mx-auto max-w-lg py-8 sm:py-12" aria-labelledby="reader-sign-in-title">
      <p className="mb-3 font-sans text-sm font-medium text-muted-foreground">Your reading space</p>
      <h1 id="reader-sign-in-title" className="font-display text-2xl font-semibold leading-tight text-foreground">{title}</h1>
      <p className="mt-4 font-sans text-base leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild className="h-auto max-w-full whitespace-normal text-center"><Link to={getReaderSignInPath(destination)}>Sign in</Link></Button>
        <Button asChild variant="outline" className="h-auto max-w-full whitespace-normal text-center"><Link to="/">Back to Brack home</Link></Button>
      </div>
    </section>
  );
}
