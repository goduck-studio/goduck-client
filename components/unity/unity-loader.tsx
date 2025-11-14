"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "next-intl";

interface UnityBuildConfig {
  buildName?: string;
  dataUrl?: string;
  frameworkUrl?: string;
  codeUrl?: string | string[];
  wasmCodeUrl?: string;
  wasmFiles?: string[];
  streamingAssetsUrl?: string;
  companyName?: string;
  productName?: string;
  productVersion?: string;
  arguments?: string[];
}

interface UnityInstanceConfig {
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string | string[];
  streamingAssetsUrl: string;
  companyName: string;
  productName: string;
  productVersion: string;
  arguments?: string[];
  showBanner?: (msg: string, type: "error" | "warning" | "info") => void;
  [key: string]: unknown;
}

interface UnityInstance {
  Quit: () => void;
  SendMessage: (
    gameObjectName: string,
    methodName: string,
    value?: string | number | boolean
  ) => void;
  SetFullscreen: (fullscreen: boolean) => void;
  [key: string]: unknown;
}

type UnityProgressCallback = (progress: number) => void;
type CreateUnityInstance = (
  canvas: HTMLCanvasElement,
  config: UnityInstanceConfig,
  onProgress?: UnityProgressCallback
) => Promise<UnityInstance>;

declare global {
  interface Window {
    createUnityInstance?: CreateUnityInstance;
  }
}

interface UnityLoaderProps {
  buildUrl?: string;
  buildFolder?: string;
  buildName?: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function UnityLoader({
  buildUrl = "/game/GODUCK",
  buildFolder = "Build",
  buildName,
  width = "100%",
  height = 600,
  className,
}: UnityLoaderProps) {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const unityInstanceRef = useRef<UnityInstance | null>(null);

  useEffect(() => {
    let script: HTMLScriptElement | null = null;

    const loadUnity = async () => {
      if (!canvasRef.current) return;

      try {
        setIsLoading(true);
        setError(null);
        setProgress(0);

        let detectedBuildName = buildName;
        if (!detectedBuildName) {
          const urlParts = buildUrl.split("/").filter(Boolean);
          detectedBuildName = urlParts[urlParts.length - 1] || "GODUCK";
        }
        let buildConfig: UnityBuildConfig | null = null;
        try {
          const buildJsonResponse = await fetch(
            `${buildUrl}/${buildFolder}/Build.json`
          );
          if (buildJsonResponse.ok) {
            const jsonData = await buildJsonResponse.json();
            buildConfig = jsonData as UnityBuildConfig;
            if (buildConfig.buildName) {
              detectedBuildName = buildConfig.buildName;
            }
          }
        } catch {}

        const loaderUrl = `${buildUrl}/${buildFolder}/${detectedBuildName}.loader.js`;

        script = document.createElement("script");
        script.src = loaderUrl;
        script.async = false;
        script.defer = true;

        script.onload = async () => {
          try {
            await new Promise<void>((resolve) => {
              if (document.readyState === "complete") {
                resolve();
              } else {
                window.addEventListener("load", () => resolve(), {
                  once: true,
                });
              }
            });

            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
              });
            });

            if (!window.createUnityInstance) {
              throw new Error(t("game.loaderNotFound"));
            }
            if (!canvasRef.current) {
              throw new Error(t("game.canvasNotFound"));
            }

            if (!canvasRef.current.isConnected) {
              throw new Error(t("game.canvasNotConnected"));
            }

            const buildPath = `${buildUrl}/${buildFolder}`;

            let codeUrl: string | string[] =
              buildConfig?.codeUrl ||
              `${buildPath}/${detectedBuildName}.wasm.unityweb`;

            if (
              buildConfig?.wasmFiles &&
              Array.isArray(buildConfig.wasmFiles)
            ) {
              codeUrl = buildConfig.wasmFiles.map((file: string) => {
                if (file.startsWith("http") || file.startsWith("/")) {
                  return file;
                }
                return `${buildPath}/${file}`;
              });
            } else if (buildConfig?.wasmCodeUrl) {
              codeUrl =
                buildConfig.wasmCodeUrl.startsWith("http") ||
                buildConfig.wasmCodeUrl.startsWith("/")
                  ? buildConfig.wasmCodeUrl
                  : `${buildPath}/${buildConfig.wasmCodeUrl}`;
            } else if (buildConfig && typeof buildConfig.codeUrl === "string") {
              codeUrl =
                buildConfig.codeUrl.startsWith("http") ||
                buildConfig.codeUrl.startsWith("/")
                  ? buildConfig.codeUrl
                  : `${buildPath}/${buildConfig.codeUrl}`;
            } else if (buildConfig && Array.isArray(buildConfig.codeUrl)) {
              codeUrl = buildConfig.codeUrl.map((url: string) => {
                if (url.startsWith("http") || url.startsWith("/")) {
                  return url;
                }
                return `${buildPath}/${url}`;
              });
            }

            const showBanner = (
              msg: string,
              type: "error" | "warning" | "info"
            ) => {
              if (type === "error") {
                setError(msg);
              }
            };

            const config: UnityInstanceConfig = {
              dataUrl:
                buildConfig?.dataUrl ||
                `${buildPath}/${detectedBuildName}.data.unityweb`,
              frameworkUrl:
                buildConfig?.frameworkUrl ||
                `${buildPath}/${detectedBuildName}.framework.js.unityweb`,
              codeUrl,
              streamingAssetsUrl:
                buildConfig?.streamingAssetsUrl ||
                `${buildUrl}/StreamingAssets`,
              companyName: buildConfig?.companyName || "DefaultCompany",
              productName: (buildConfig?.productName ||
                detectedBuildName) as string,
              productVersion: buildConfig?.productVersion || "0.0.1",
              arguments: buildConfig?.arguments || [],
              showBanner,
            };

            try {
              const instance = await window.createUnityInstance(
                canvasRef.current,
                config,
                (progress: number) => {
                  const progressPercent = Math.round(progress * 100);
                  setProgress(progressPercent);
                }
              );

              unityInstanceRef.current = instance;
              setIsReady(true);
              setIsLoading(false);
            } catch (unityError) {
              if (
                unityError instanceof Error &&
                unityError.message.includes("querySelector")
              ) {
                throw new Error(
                  t("game.domError", { error: unityError.message })
                );
              }
              throw unityError;
            }
          } catch (err) {
            const errorMessage =
              err instanceof Error
                ? `${err.message}\n\n${t("game.consoleCheck")}`
                : `${t("game.loadError")}\n\n${t("game.consoleCheck")}`;
            setError(errorMessage);
            setIsLoading(false);
          }
        };

        script.onerror = () => {
          const errorMsg = `${t("game.scriptLoadError")}\n\n${t(
            "game.scriptLoadErrorDetails",
            { url: loaderUrl }
          )}\n\n${t("game.scriptLoadErrorCauses")}`;
          setError(errorMsg);
          setIsLoading(false);
        };

        document.body.appendChild(script);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("game.cannotLoad"));
        setIsLoading(false);
      }
    };

    loadUnity();

    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (unityInstanceRef.current) {
        try {
          unityInstanceRef.current.Quit();
        } catch {}
      }
    };
  }, [buildUrl, buildFolder, buildName, t]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setIsReady(false);
    window.location.reload();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("game.title")}</CardTitle>
        <CardDescription>
          {isLoading && t("game.loading", { progress })}
          {error && t("game.error")}
          {isReady && t("game.ready")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          id="unity-container"
          className="relative bg-black rounded-lg overflow-hidden"
          style={{ width, height }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10">
              <div className="mb-4">
                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
              <p className="text-sm">{t("game.loading", { progress })}</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10 p-4">
              <p className="text-red-400 mb-4 text-center">{error}</p>
              <Button
                onClick={handleRetry}
                variant="outline"
                className="bg-white text-black hover:bg-gray-200"
              >
                {t("common.retry")}
              </Button>
              <p className="text-xs mt-4 text-gray-400 text-center">
                {t("game.fileCheck")}
                <br />
                {t("game.requiredFiles")}
              </p>
            </div>
          )}
          <canvas
            id="unity-canvas"
            ref={canvasRef}
            width={1280}
            height={720}
            tabIndex={-1}
            className="w-full h-full"
            style={{ display: isReady && !error ? "block" : "none" }}
          />
          <div id="unity-loading-bar" style={{ display: "none" }}>
            <div id="unity-logo"></div>
            <div id="unity-progress-bar-empty">
              <div id="unity-progress-bar-full"></div>
            </div>
          </div>
          <div id="unity-warning" style={{ display: "none" }}></div>
          <div id="unity-footer" style={{ display: "none" }}>
            <div id="unity-fullscreen-button"></div>
            <div id="unity-build-title"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
