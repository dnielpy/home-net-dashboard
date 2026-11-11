import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <path d="M3 3v18h18" />
      <path d="m7 15 4-5 3 3 5-6" />
    </svg>
  );
}
