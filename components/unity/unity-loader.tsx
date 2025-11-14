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

// Unity Build.json 타입 정의
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

// Unity 인스턴스 설정 타입
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

// Unity 인스턴스 타입
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

// Unity 로더 함수 타입
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
  buildFolder?: string; // Build 폴더 이름 (기본값: "Build")
  buildName?: string; // 빌드 파일 이름 (기본값: "GODUCK" 또는 자동 감지)
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

        // 빌드 파일 이름 결정
        // buildName이 제공되지 않으면 buildUrl에서 추출하거나 기본값 사용
        let detectedBuildName = buildName;
        if (!detectedBuildName) {
          // buildUrl에서 폴더 이름 추출 (예: /game/GODUCK -> GODUCK)
          const urlParts = buildUrl.split("/").filter(Boolean);
          detectedBuildName = urlParts[urlParts.length - 1] || "GODUCK";
        }

        // Build.json 파일을 읽어서 빌드 설정 가져오기 (선택적)
        let buildConfig: UnityBuildConfig | null = null;
        try {
          const buildJsonResponse = await fetch(
            `${buildUrl}/${buildFolder}/Build.json`
          );
          if (buildJsonResponse.ok) {
            const jsonData = await buildJsonResponse.json();
            buildConfig = jsonData as UnityBuildConfig;
            // Build.json에서 buildName이 있으면 사용
            if (buildConfig.buildName) {
              detectedBuildName = buildConfig.buildName;
            }
          }
        } catch (e) {
          // Build.json이 없어도 괜찮음 (index.html 기반 구조)
          console.warn(
            "Build.json을 읽을 수 없습니다. index.html 구조를 사용합니다.",
            e
          );
        }

        // 로더 스크립트 경로 (index.html 구조에 맞춤)
        const loaderUrl = `${buildUrl}/${buildFolder}/${detectedBuildName}.loader.js`;
        console.log("[Unity Loader] 로더 스크립트 URL:", loaderUrl);

        // Unity 로더 스크립트 로드
        // async 대신 defer를 사용하여 DOM 준비 후 실행되도록 함
        script = document.createElement("script");
        script.src = loaderUrl;
        script.async = false; // Unity 로더는 순차적으로 로드되어야 함
        script.defer = true;

        script.onload = async () => {
          try {
            console.log("[Unity Loader] 스크립트 로드 완료");

            // DOM이 완전히 준비될 때까지 대기
            await new Promise<void>((resolve) => {
              if (document.readyState === "complete") {
                resolve();
              } else {
                window.addEventListener("load", () => resolve(), {
                  once: true,
                });
              }
            });

            // 추가로 requestAnimationFrame을 사용하여 DOM 업데이트 완료 대기
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
              });
            });

            if (!window.createUnityInstance) {
              throw new Error(
                "createUnityInstance 함수를 찾을 수 없습니다. Unity 로더 스크립트가 제대로 로드되지 않았을 수 있습니다."
              );
            }
            if (!canvasRef.current) {
              throw new Error("Canvas 요소를 찾을 수 없습니다.");
            }

            // Canvas가 DOM에 완전히 마운트되었는지 확인
            if (!canvasRef.current.isConnected) {
              throw new Error("Canvas 요소가 DOM에 연결되지 않았습니다.");
            }

            // Unity 인스턴스 생성 설정
            // index.html 구조에 맞춰서 .unityweb 확장자 사용
            const buildPath = `${buildUrl}/${buildFolder}`;

            // Build.json의 설정을 우선 사용하고, 없으면 index.html 구조 사용
            let codeUrl: string | string[] =
              buildConfig?.codeUrl ||
              `${buildPath}/${detectedBuildName}.wasm.unityweb`;

            // WebAssembly 파일이 여러 개일 수 있으므로 codeUrl을 배열로 처리
            if (
              buildConfig?.wasmFiles &&
              Array.isArray(buildConfig.wasmFiles)
            ) {
              codeUrl = buildConfig.wasmFiles.map((file: string) => {
                // 절대 경로인지 확인
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

            // showBanner 함수 정의 (에러/경고 표시용)
            const showBanner = (
              msg: string,
              type: "error" | "warning" | "info"
            ) => {
              if (type === "error") {
                setError(msg);
              } else {
                console.warn(`[Unity ${type}]:`, msg);
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

            console.log("[Unity Loader] Unity 인스턴스 설정:", {
              dataUrl: config.dataUrl,
              frameworkUrl: config.frameworkUrl,
              codeUrl: config.codeUrl,
              streamingAssetsUrl: config.streamingAssetsUrl,
            });

            // Unity 인스턴스 생성
            console.log("[Unity Loader] Unity 인스턴스 생성 시작...");

            // Unity 로더가 DOM을 조작할 때 발생할 수 있는 오류를 방지하기 위해
            // try-catch로 감싸고, 에러 핸들러를 추가
            try {
              const instance = await window.createUnityInstance(
                canvasRef.current,
                config,
                (progress: number) => {
                  const progressPercent = Math.round(progress * 100);
                  setProgress(progressPercent);
                  if (progressPercent % 10 === 0) {
                    console.log(
                      `[Unity Loader] 로딩 진행률: ${progressPercent}%`
                    );
                  }
                }
              );
              console.log("[Unity Loader] Unity 인스턴스 생성 완료");

              unityInstanceRef.current = instance;
              setIsReady(true);
              setIsLoading(false);
            } catch (unityError) {
              // Unity 인스턴스 생성 중 발생한 에러를 더 자세히 로깅
              console.error(
                "[Unity Loader] Unity 인스턴스 생성 중 에러:",
                unityError
              );

              // querySelector 관련 에러인 경우 특별 처리
              if (
                unityError instanceof Error &&
                unityError.message.includes("querySelector")
              ) {
                throw new Error(
                  `DOM 조작 오류: Unity 로더가 DOM 요소를 찾지 못했습니다. ` +
                    `이는 React의 가상 DOM과 Unity 로더의 충돌일 수 있습니다. ` +
                    `원본 에러: ${unityError.message}`
                );
              }
              throw unityError;
            }
          } catch (err) {
            console.error("[Unity Loader] Unity 인스턴스 생성 오류:", err);
            const errorMessage =
              err instanceof Error
                ? `${err.message}\n\n상세 정보는 브라우저 콘솔을 확인하세요.`
                : "게임 로드에 실패했습니다.\n\n상세 정보는 브라우저 콘솔을 확인하세요.";
            setError(errorMessage);
            setIsLoading(false);
          }
        };

        script.onerror = (event) => {
          console.error("[Unity Loader] 스크립트 로드 오류:", event);
          const errorMsg = `Unity 로더 스크립트를 로드할 수 없습니다.\n\n시도한 URL: ${loaderUrl}\n\n가능한 원인:\n1. 파일 경로가 잘못되었습니다\n2. CORS 정책 문제입니다\n3. 파일이 존재하지 않습니다\n\n브라우저 개발자 도구의 Network 탭에서 파일 요청 상태를 확인하세요.`;
          setError(errorMsg);
          setIsLoading(false);
        };

        document.body.appendChild(script);
      } catch (err) {
        console.error("Unity 로드 오류:", err);
        setError(
          err instanceof Error ? err.message : "게임을 로드할 수 없습니다."
        );
        setIsLoading(false);
      }
    };

    loadUnity();

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (unityInstanceRef.current) {
        try {
          unityInstanceRef.current.Quit();
        } catch (e) {
          console.error("Unity 인스턴스 종료 오류:", e);
        }
      }
    };
  }, [buildUrl, buildFolder, buildName]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setIsReady(false);
    // 페이지 리로드로 재시도
    window.location.reload();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Unity 게임</CardTitle>
        <CardDescription>
          {isLoading && `로딩 중... ${progress}%`}
          {error && "게임을 로드하는 중 오류가 발생했습니다."}
          {isReady && "게임이 준비되었습니다."}
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
              <p className="text-sm">로딩 중... {progress}%</p>
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
                다시 시도
              </Button>
              <p className="text-xs mt-4 text-gray-400 text-center">
                게임 파일을 public/game/GODUCK 폴더에 올바르게 배치했는지
                확인하세요.
                <br />
                필요한 파일: Build/GODUCK.loader.js,
                Build/GODUCK.framework.js.unityweb, Build/GODUCK.wasm.unityweb,
                Build/GODUCK.data.unityweb
              </p>
            </div>
          )}
          {/* Unity 로더가 찾는 요소들 */}
          <canvas
            id="unity-canvas"
            ref={canvasRef}
            width={1280}
            height={720}
            tabIndex={-1}
            className="w-full h-full"
            style={{ display: isReady && !error ? "block" : "none" }}
          />
          {/* Unity 로더가 사용하는 숨겨진 요소들 */}
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
