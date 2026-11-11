import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <path d="M20 11a8 8 0 0 0-14.9-3.5L4 9" />
      <path d="M4 4v5h5" />
      <path d="M4 13a8 8 0 0 0 14.9 3.5L20 15" />
      <path d="M20 20v-5h-5" />
    </svg>
  );
}
