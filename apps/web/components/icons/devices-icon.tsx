import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function DevicesIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <rect x="2" y="4" width="14" height="10" rx="1.5" />
      <path d="M6 18h6" />
      <path d="M9 14v4" />
      <rect x="16" y="9" width="6" height="11" rx="1.5" />
      <path d="M19 17h.01" />
    </svg>
  );
}
