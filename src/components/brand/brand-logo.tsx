import Image from "next/image";
import "./brand.css";

export function BrandLogo({ eager = false }: { eager?: boolean }) {
  return (
    <span className="brand-logo" aria-hidden="true">
      <Image
        className="brand-logo-light"
        src="/brand/logo.svg"
        width={492}
        height={100}
        loading={eager ? "eager" : "lazy"}
        alt=""
      />
      <Image
        className="brand-logo-dark"
        src="/brand/logo-dark.svg"
        width={492}
        height={100}
        loading={eager ? "eager" : "lazy"}
        alt=""
      />
    </span>
  );
}
