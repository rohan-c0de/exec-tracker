import Image from "next/image";

type Size = "sm" | "lg";

const sizeMap: Record<Size, { px: number; cls: string; text: string }> = {
  sm: { px: 48, cls: "h-12 w-12", text: "text-base" },
  lg: { px: 128, cls: "h-32 w-32", text: "text-3xl" },
};

export function Avatar({
  name,
  photoPath,
  size = "sm",
}: {
  name: string;
  photoPath?: string;
  size?: Size;
}) {
  const { px, cls, text } = sizeMap[size];
  const ring =
    "ring-1 ring-zinc-200 dark:ring-zinc-800 bg-zinc-100 dark:bg-zinc-900";
  const base = `${cls} ${ring} relative shrink-0 overflow-hidden rounded-full`;

  if (photoPath) {
    return (
      <div className={base}>
        <Image
          src={photoPath}
          alt={`Headshot of ${name}`}
          width={px * 2}
          height={px * 2}
          sizes={`${px}px`}
          className="h-full w-full object-cover"
          priority={size === "lg"}
        />
      </div>
    );
  }

  return (
    <div
      className={`${base} flex items-center justify-center font-medium text-zinc-600 dark:text-zinc-300 ${text}`}
      aria-label={name}
    >
      {initialsOf(name)}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
