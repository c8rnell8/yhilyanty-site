"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadIcon,
  VideoCameraIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

/** In-browser drop zone that uploads a single video to
 *  /api/editor/sessions/standalone (Discord-login required) and redirects to
 *  the resulting editor page. Mirrors the acceptance rules of the backend. */
const ACCEPTED_EXT = [".mp4", ".mov", ".webm", ".mkv", ".m4v", ".gif"];
// Must stay in sync with MAX_SOURCE_BYTES in src/lib/editor/session.ts
// (currently 100 MB). Going higher here just wastes the user's bandwidth
// because the server will reject the file after the full upload completes.
const MAX_MB = 100;

export function StandaloneUploader({
  locale,
  strings,
}: {
  locale: string;
  strings: {
    drop: string;
    browse: string;
    hint: string;
    pleaseLogin: string;
    tooLarge: string;
    unsupported: string;
    uploading: string;
    uploadFailed: string;
  };
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function upload(file: File) {
    setError(null);
    const name = file.name.toLowerCase();
    const ext = name.slice(name.lastIndexOf(".")) || "";
    if (!ACCEPTED_EXT.includes(ext)) {
      setError(strings.unsupported);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(strings.tooLarge);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      // Use XHR for real progress events (fetch doesn't expose upload progress).
      const body = new FormData();
      body.append("file", file);
      body.append("locale", locale);
      const res: { id: string; editorUrl: string } = await new Promise(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/editor/sessions/standalone");
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });
          xhr.addEventListener("load", () => {
            try {
              const j = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) resolve(j);
              else {
                if (xhr.status === 401) reject(new Error(strings.pleaseLogin));
                else reject(new Error(j.error || `HTTP ${xhr.status}`));
              }
            } catch {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          });
          xhr.addEventListener("error", () =>
            reject(new Error("Network error"))
          );
          xhr.send(body);
        }
      );
      router.push(res.editorUrl);
    } catch (e) {
      setError(
        `${strings.uploadFailed}: ${e instanceof Error ? e.message : String(e)}`
      );
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-sm border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
            : "border-[color:var(--border-strong)] hover:border-[color:var(--accent)]/60"
        } ${uploading ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_EXT.join(",")}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex size-14 items-center justify-center rounded-sm border border-[color:var(--accent)]/40 bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            {uploading ? (
              <UploadIcon className="size-7" weight="bold" />
            ) : (
              <VideoCameraIcon className="size-7" weight="bold" />
            )}
          </span>
          {uploading ? (
            <>
              <p className="font-bold">{strings.uploading}</p>
              <div className="w-full max-w-xs h-2 rounded-sm bg-[color:var(--background-elev)] overflow-hidden">
                <div
                  className="h-full bg-[color:var(--accent)] transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="font-mono text-xs text-[color:var(--muted-2)]">
                {progress}%
              </span>
            </>
          ) : (
            <>
              <p className="font-bold text-lg">{strings.drop}</p>
              <span className="tactical-text text-[color:var(--accent)]">
                {strings.browse}
              </span>
              <p className="tactical-text text-[10px] text-[color:var(--muted)]">
                {strings.hint}
              </p>
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-sm border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">
          <WarningCircleIcon className="size-5 shrink-0 mt-0.5" weight="bold" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
