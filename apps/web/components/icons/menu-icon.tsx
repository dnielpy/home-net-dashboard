import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
