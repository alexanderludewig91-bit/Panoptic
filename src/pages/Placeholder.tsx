import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PlaceholderProps {
  title: string;
  description: string;
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Construction className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">In Entwicklung</h2>
          <p className="mt-2 text-center text-muted-foreground">
            Dieses Modul wird in einer zukünftigen Version verfügbar sein.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
