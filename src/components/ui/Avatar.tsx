import { cn } from "@/lib/utils";

const COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-violet-500",
];

function getColor(name: string) {
  const idx = name.charCodeAt(0) % COLORS.length;
  return COLORS[idx];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

export default function Avatar({ name, src, size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover", sizeMap[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0",
        sizeMap[size],
        getColor(name),
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}

interface AvatarGroupProps {
  names: string[];
  max?: number;
  size?: "sm" | "md" | "lg";
}

export function AvatarGroup({ names, max = 3, size = "sm" }: AvatarGroupProps) {
  const visible = names.slice(0, max);
  const rest = names.length - max;
  return (
    <div className="flex -space-x-1.5">
      {visible.map((name) => (
        <Avatar
          key={name}
          name={name}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {rest > 0 && (
        <div
          className={cn(
            "rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium ring-2 ring-white",
            sizeMap[size]
          )}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}
