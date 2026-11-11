import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function AntennaIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="1.5" />
      <path d="M12 14v7M9 21h6" />
      <path d="M5.5 6.5a8 8 0 0 0 0 5" />
      <path d="M18.5 6.5a8 8 0 0 1 0 5" />
    </svg>
  );
}
