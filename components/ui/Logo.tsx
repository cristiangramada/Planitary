import Image from "next/image";
import { cn } from "@/utils/cn";

type LogoProps = {
  /** Pixel size for width and height. */
  size?: number;
  className?: string;
  priority?: boolean;
};

export function Logo({ size = 36, className, priority }: LogoProps) {
  return (
    <Image
      src="/planitary-logo.png"
      alt="Planitary"
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={cn("shrink-0", className)}
    />
  );
}
