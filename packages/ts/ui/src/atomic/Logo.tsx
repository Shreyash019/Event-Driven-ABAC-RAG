import type { ImgHTMLAttributes } from "react";

const DEFAULT_SRC = "https://your-cdn/logo.png";

export interface LogoProps extends ImgHTMLAttributes<HTMLImageElement> {
  size?: number | string;
}

export function Logo({ src = DEFAULT_SRC, alt = "ARAC", size = 32, style, ...rest }: LogoProps) {
  return (
    <img
      src={src}
      alt={alt} 
      height={size}                              
      style={{ height: size, width: "auto", display: "block", ...style }} 
      {...rest}                                
    />
  );
}