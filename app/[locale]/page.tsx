import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { games } from "@/lib/games";
import { getTranslations } from "next-intl/server";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="mb-8 sm:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-4">{t("home.title")}</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
          {games.map((game) => (
            <Link key={game.id} href={`/${locale}/game/${game.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
                    <div className="text-4xl">🎮</div>
                  </div>
                  <CardTitle>
                    {t(`games.${game.id}.title`, { defaultValue: game.title })}
                  </CardTitle>
                  <CardDescription>
                    {t(`games.${game.id}.description`, {
                      defaultValue: game.description,
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t("common.clickToStart")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {games.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("common.noGames")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
