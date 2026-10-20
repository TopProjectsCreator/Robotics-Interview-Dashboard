import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import EmojiPicker, { Categories, EmojiStyle, Theme, type EmojiClickData } from "emoji-picker-react";
import { Check, SmilePlus, Upload, X } from "lucide-react";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import {
  getListChatCustomEmojisQueryKey,
  useUploadChatCustomEmoji,
} from "@workspace/api-client-react";

type SharedEmoji = {
  id: string;
  name: string;
  imagePath: string;
};

type Props = {
  dark: boolean;
  customEmojis: readonly SharedEmoji[];
  customEmojiLoadFailed?: boolean;
  onRetryCustomEmojis?: () => void;
  onSelect: (value: string) => void;
};

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGE_BYTES = 512 * 1024;

function storageImageUrl(imagePath: string): string {
  const objectId = imagePath.replace(/^\/objects\//, "");
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}/api/storage/objects/${encodeURIComponent(objectId)}`;
}

async function encodeBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function InterviewerChatEmojiPicker({ dark, customEmojis, customEmojiLoadFailed = false, onRetryCustomEmojis, onSelect }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadEmoji = useUploadChatCustomEmoji();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const pickerCustomEmojis = useMemo(
    () => customEmojis.map(emoji => ({
      id: emoji.id,
      names: [emoji.name],
      imgUrl: storageImageUrl(emoji.imagePath),
      group: "Team",
    })),
    [customEmojis],
  );

  const handleEmojiClick = (emoji: EmojiClickData) => {
    onSelect(emoji.isCustom ? `:${emoji.names[0]}:` : emoji.emoji);
  };

  const submitUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const normalizedName = name.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,32}$/.test(normalizedName)) {
      setError("Use 2–32 lowercase letters, numbers, or underscores.");
      return;
    }
    if (!file) {
      setError("Choose an image to upload.");
      return;
    }
    if (!IMAGE_TYPES.has(file.type)) {
      setError("Choose a PNG, JPEG, GIF, or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Images must be 512 KB or smaller.");
      return;
    }
    try {
      await uploadEmoji.mutateAsync({
        data: {
          name: normalizedName,
          contentType: file.type as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          imageBase64: await encodeBase64(file),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListChatCustomEmojisQueryKey() });
      setName("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadOpen(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The emoji could not be uploaded.");
    }
  };

  // The picker opens upward from the composer. When the software keyboard is
  // open the visible area is much shorter, so cap the grid to what is left.
  const { height: viewportHeight } = useVisualViewport();
  const pickerHeight = viewportHeight
    ? Math.max(200, Math.min(340, Math.round(viewportHeight * 0.5)))
    : 340;

  return (
    <div
      className="absolute bottom-[calc(100%+10px)] right-0 z-40 max-h-[min(70dvh,420px)] w-[min(360px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-2xl border border-[#d5e0e0] bg-white shadow-[0_12px_32px_rgba(24,58,75,0.2)] dark:border-[#355663] dark:bg-[#172b38]"
      role="dialog"
      aria-label="Emoji picker"
      data-testid="emoji-picker"
    >
      <div className="flex items-center justify-between border-b border-[#e5ecec] px-3 py-2.5 dark:border-[#2a3f52]">
        <div className="flex items-center gap-2">
          <SmilePlus size={16} className="text-[#16869a] dark:text-[#6fc3cf]" />
          <span className="text-xs font-semibold text-[#183a4b] dark:text-[#e8eef2]">Emoji</span>
          <span className="rounded-full bg-[#edf4f3] px-1.5 py-0.5 text-[10px] font-semibold text-[#527079] dark:bg-[#1d3744] dark:text-[#9fb3bd]">
            {customEmojis.length} team
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setUploadOpen(open => !open); setError(""); }}
          aria-expanded={uploadOpen}
          aria-label={uploadOpen ? "Close team emoji upload" : "Add a team emoji"}
          data-testid="button-add-team-emoji"
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#16869a] transition hover:bg-[#edf4f3] dark:text-[#6fc3cf] dark:hover:bg-[#1d3744]"
        >
          {uploadOpen ? <X size={13} /> : <Upload size={13} />}
          {uploadOpen ? "Close" : "Add team emoji"}
        </button>
      </div>

      <div className="interviewer-emoji-picker">
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          customEmojis={pickerCustomEmojis}
          categories={[
            { category: Categories.SUGGESTED, name: "Frequently used" },
            { category: Categories.CUSTOM, name: "Team emojis", group: "Team" },
            { category: Categories.SMILEYS_PEOPLE, name: "Smileys & people" },
            { category: Categories.ANIMALS_NATURE, name: "Animals & nature" },
            { category: Categories.FOOD_DRINK, name: "Food & drink" },
            { category: Categories.TRAVEL_PLACES, name: "Travel & places" },
            { category: Categories.ACTIVITIES, name: "Activities" },
            { category: Categories.OBJECTS, name: "Objects" },
            { category: Categories.SYMBOLS, name: "Symbols" },
            { category: Categories.FLAGS, name: "Flags" },
          ]}
          theme={dark ? Theme.DARK : Theme.LIGHT}
          emojiStyle={EmojiStyle.NATIVE}
          searchPlaceHolder="Search emojis"
          width="100%"
          height={pickerHeight}
          lazyLoadEmojis
          autoFocusSearch
          previewConfig={{ showPreview: false }}
        />
      </div>

      {customEmojiLoadFailed && (
        <div className="flex items-center justify-between gap-2 border-t border-[#e5ecec] px-3 py-2 text-[11px] text-[#8c514b] dark:border-[#2a3f52] dark:text-[#e89890]" role="alert">
          <span>Team emojis couldn’t load.</span>
          {onRetryCustomEmojis && <button type="button" onClick={onRetryCustomEmojis} className="font-semibold underline underline-offset-2">Retry</button>}
        </div>
      )}

      {uploadOpen && (
        <form onSubmit={submitUpload} className="space-y-2.5 border-t border-[#e5ecec] bg-[#f7faf9] p-3 dark:border-[#2a3f52] dark:bg-[#10232d]" data-testid="form-upload-team-emoji">
          <div>
            <label htmlFor="team-emoji-name" className="mb-1 block text-[11px] font-semibold text-[#385762] dark:text-[#b9c9d1]">Short name</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#71878d]">:</span>
              <input
                id="team-emoji-name"
                value={name}
                onChange={event => setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32))}
                placeholder="rover"
                minLength={2}
                maxLength={32}
                autoComplete="off"
                data-testid="input-team-emoji-name"
                className="h-9 min-w-0 flex-1 rounded-lg border border-[#d5e0e0] bg-white px-2.5 text-xs text-[#183a4b] outline-none focus:border-[#16869a] dark:border-[#355663] dark:bg-[#172b38] dark:text-[#e8eef2]"
              />
              <span className="text-xs text-[#71878d]">:</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={event => setFile(event.target.files?.[0] ?? null)}
            aria-label="Choose custom emoji image"
            data-testid="input-team-emoji-image"
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-select-team-emoji-image"
            className="flex h-9 w-full items-center justify-between rounded-lg border border-dashed border-[#b9cdd0] bg-white px-2.5 text-left text-xs text-[#52666e] transition hover:border-[#16869a] dark:border-[#355663] dark:bg-[#172b38] dark:text-[#b9c9d1]"
          >
            <span className="flex min-w-0 items-center gap-2"><Upload size={14} className="shrink-0 text-[#16869a] dark:text-[#6fc3cf]" /><span className="truncate">{file?.name ?? "Choose PNG, JPEG, GIF, or WebP"}</span></span>
            {file && <span className="ml-2 shrink-0 text-[10px] text-[#71878d]">{Math.max(1, Math.ceil(file.size / 1024))} KB</span>}
          </button>
          {error && <p className="text-[11px] text-[#a34d46] dark:text-[#e89890]" role="alert" data-testid="team-emoji-upload-error">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-[#71878d] dark:text-[#9aadb5]">Shared with the whole team · max 512 KB</p>
            <button
              type="submit"
              disabled={uploadEmoji.isPending}
              data-testid="button-upload-team-emoji"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#16869a] px-3 text-[11px] font-semibold text-white transition hover:bg-[#106d7a] disabled:opacity-50"
            >
              {uploadEmoji.isPending ? <span className="animate-pulse">Uploading…</span> : <><Check size={13} /> Upload</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}