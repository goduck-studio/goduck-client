export interface GameInfo {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  buildUrl: string;
  buildFolder: string;
  buildName: string;
}

export const games: GameInfo[] = [
  {
    id: "goduck",
    title: "GODUCK",
    description: "Unity로 개발된 GODUCK 게임",
    buildUrl: "/game/GODUCK",
    buildFolder: "Build",
    buildName: "GODUCK",
  },
];

export function getGameById(id: string): GameInfo | undefined {
  return games.find((game) => game.id === id);
}

