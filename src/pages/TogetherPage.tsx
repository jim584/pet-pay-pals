import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, HeartHandshake, ShieldCheck, Stethoscope, ArrowRight } from "lucide-react";

const benefits = [
  {
    icon: Stethoscope,
    title: "Veterinary care support",
    description:
      "Membership benefits help cover eligible veterinary care for your enrolled pet, submitted directly by your veterinarian.",
  },
  {
    icon: ShieldCheck,
    title: "A community reserve",
    description:
      "Contributions build a shared community reserve so members can be supported when unexpected care is needed.",
  },
  {
    icon: HeartHandshake,
    title: "Care without the crisis",
    description:
      "Predictable monthly membership instead of a sudden bill, with flexible payment options where available.",
  },
];

export default function TogetherPage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="border-b bg-primary/5">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Users className="h-3.5 w-3.5" />
            Membership
          </span>
          <h1 className="mt-4 font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Help A Pet Together™
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            A membership built around one simple idea: pet families are stronger together.
            Join to help protect your own pet's care and to strengthen the community reserve
            that supports other pets in need.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/plans">
                View membership plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/">Back to Help A Pet Now</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center font-heading text-2xl font-semibold text-foreground">
          What membership includes
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {benefits.map((b) => (
            <Card key={b.title}>
              <CardHeader className="pb-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <b.icon className="h-5 w-5 text-primary" />
                </span>
                <CardTitle className="pt-2 text-base">{b.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{b.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <h2 className="text-center font-heading text-2xl font-semibold text-foreground">
            How it works
          </h2>
          <ol className="mx-auto mt-8 max-w-2xl space-y-4">
            {[
              "Choose a membership plan for your pet.",
              "Enroll your pet and add your veterinarian of record.",
              "Your veterinarian submits eligible care directly through Help A Pet.",
              "Approved care is applied against your membership benefits.",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm text-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Button size="lg" asChild>
              <Link to="/plans">
                Sign up for a membership
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
