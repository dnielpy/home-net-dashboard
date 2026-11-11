import { type IconProps, outlineIconProps } from "@/components/icons/icon-props";

export function RouterIcon({ className }: IconProps) {
  return (
    <svg {...outlineIconProps} className={className} aria-hidden>
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 16.5h.01M11 16.5h.01" />
      <path d="M15 13V9" />
      <path d="M12 7a4.5 4.5 0 0 1 6 0" />
      <path d="M9.5 4.5a8 8 0 0 1 11 0" />
    </svg>
  );
}
