"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { LocaleSwitcher } from "./locale-switcher";
import Link from "next/link";

export function Header() {
  const locale = useLocale();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-24 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={`/${locale}`}
          className="flex items-center hover:opacity-80 transition-opacity"
        >
          <Image
            src="/goduck-icon.png"
            alt="GODUCK"
            width={1000}
            height={300}
            className="h-14 sm:h-16 lg:h-20 w-auto"
            quality={100}
            priority
            unoptimized={false}
            style={{
              objectFit: "contain",
              imageRendering: "crisp-edges",
            }}
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
