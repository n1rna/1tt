import type { Metadata } from "next";
import { Heart } from "lucide-react";

export const metadata: Metadata = {
  title: "Support",
  description: "Support 1two.dev — free, open-source developer tools.",
};

export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="h-5 w-5 text-red-500" />
        <h1 className="text-2xl font-bold">Support 1two.dev</h1>
      </div>
      <div className="prose prose-sm dark:prose-invert text-muted-foreground space-y-4">
        <p>
          1two.dev is free and open source. If you find these tools useful,
          consider supporting the project to help keep it running and growing.
        </p>
        <p>
          Donations help cover hosting costs and fund development of new tools.
        </p>
        <p className="text-sm text-muted-foreground/60">
          Donation links coming soon.
        </p>
      </div>
    </div>
  );
}
