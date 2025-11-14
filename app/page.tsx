import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { games } from "@/lib/games";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold mb-4">GODUCK</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {games.map((game) => (
            <Link key={game.id} href={`/game/${game.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
                    <div className="text-4xl">🎮</div>
                  </div>
                  <CardTitle>{game.title}</CardTitle>
                  <CardDescription>{game.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    클릭하여 게임 시작
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {games.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">등록된 게임이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
