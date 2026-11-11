import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function TowerIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <path d="M12 9 7 21M12 9l5 12M8.6 17h6.8" />
      <circle cx="12" cy="7" r="1.5" />
      <path d="M8.5 3.5a5 5 0 0 0 0 7M15.5 3.5a5 5 0 0 1 0 7" />
    </svg>
  );
}
