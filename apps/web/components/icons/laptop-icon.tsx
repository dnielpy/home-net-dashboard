import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function LaptopIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <rect x="4" y="4" width="16" height="11" rx="1.5" />
      <path d="M2 19h20" />
    </svg>
  );
}
