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

interface DocumentWithFullscreen extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface HTMLElementWithFullscreen extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface ScreenOrientationWithLock {
  lock: (
    orientation:
      | "portrait"
      | "landscape"
      | "portrait-primary"
      | "portrait-secondary"
      | "landscape-primary"
      | "landscape-secondary"
      | "natural"
      | "any"
  ) => Promise<void>;
  unlock: () => void;
}

interface ScreenWithOrientation {
  orientation?: ScreenOrientation & Partial<ScreenOrientationWithLock>;
}

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const unityInstanceRef = useRef<UnityInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const getFullscreenElement = (): Element | null => {
    const doc = document as DocumentWithFullscreen;
    return (
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement ||
      null
    );
  };

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setIsReady(false);
    window.location.reload();
  };

  const requestFullscreen = async (element: HTMLElement): Promise<void> => {
    const el = element as HTMLElementWithFullscreen;

    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    } else {
      throw new Error("전체화면 API를 지원하지 않는 브라우저입니다.");
    }
  };

  const exitFullscreen = async (): Promise<void> => {
    const doc = document as DocumentWithFullscreen;

    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
  };

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      const isFullscreen = !!getFullscreenElement();

      if (!isFullscreen) {
        await requestFullscreen(containerRef.current);

        // 전체화면이 완전히 활성화된 후 가로 방향으로 잠금
        setTimeout(async () => {
          const screenWithOrientation = screen as ScreenWithOrientation;
          const orientation = screenWithOrientation.orientation;

          if (orientation && orientation.lock) {
            try {
              await orientation.lock("landscape");
            } catch {
              // 화면 방향 잠금 실패는 무시 (일부 브라우저/기기에서 지원하지 않음)
              // iOS Safari 등에서는 사용자가 수동으로 화면을 돌려야 할 수 있음
            }
          }
        }, 300);
      } else {
        // 전체화면 종료 시 방향 잠금 해제
        const screenWithOrientation = screen as ScreenWithOrientation;
        const orientation = screenWithOrientation.orientation;

        if (orientation && orientation.unlock) {
          try {
            orientation.unlock();
          } catch {
            // 방향 잠금 해제 실패는 무시
          }
        }
        await exitFullscreen();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "전체화면 전환에 실패했습니다.";
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!getFullscreenElement());
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex-1">
            <CardTitle>{t("game.title")}</CardTitle>
            <CardDescription>
              {isLoading && t("game.loading", { progress })}
              {error && t("game.error")}
              {isReady && t("game.ready")}
            </CardDescription>
          </div>
          {!isLoading && (
            <Button
              onClick={handleFullscreen}
              variant="outline"
              size="sm"
              className="self-start sm:self-auto shrink-0"
              disabled={!!error}
            >
              {isFullscreen ? (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span className="hidden sm:inline">
                    {t("game.exitFullscreen")}
                  </span>
                  <span className="sm:hidden">종료</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                  <span className="hidden sm:inline">
                    {t("game.fullscreen")}
                  </span>
                  <span className="sm:hidden">전체</span>
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          id="unity-container"
          className={`relative bg-black rounded-lg overflow-hidden w-full ${
            height ? "" : "h-[400px] sm:h-[500px] lg:h-[600px]"
          } ${isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""}`}
          style={{ width, ...(height ? { height } : {}) }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10 p-4">
              <div className="mb-3 sm:mb-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
              <p className="text-xs sm:text-sm">
                {t("game.loading", { progress })}
              </p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10 p-4">
              <p className="text-red-400 mb-3 sm:mb-4 text-center text-xs sm:text-sm px-2">
                {error}
              </p>
              <Button
                onClick={handleRetry}
                variant="outline"
                className="bg-white text-black hover:bg-gray-200 text-xs sm:text-sm"
              >
                {t("common.retry")}
              </Button>
              <p className="text-[10px] sm:text-xs mt-3 sm:mt-4 text-gray-400 text-center px-2">
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
