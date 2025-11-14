import { UnityLoader } from "@/components/unity/unity-loader";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getGameById } from "@/lib/games";
import { notFound } from "next/navigation";

export default function GoduckGamePage() {
  const game = getGameById("goduck");

  if (!game) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" className="mb-4">
              ← 게임 목록으로
            </Button>
          </Link>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">{game.title}</h1>
            <p className="text-muted-foreground">{game.description}</p>
          </div>
        </div>
        
        <UnityLoader 
          buildUrl={game.buildUrl}
          buildFolder={game.buildFolder}
          buildName={game.buildName}
          width="100%"
          height={600}
          className="max-w-6xl mx-auto"
        />
      </div>
    </div>
  );
}


