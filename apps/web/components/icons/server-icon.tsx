import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function ServerIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="8" rx="1.5" />
      <rect x="3" y="13" width="18" height="8" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  );
}
