import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}
