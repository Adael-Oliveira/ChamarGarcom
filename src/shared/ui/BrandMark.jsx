import { initials } from '../../lib/theme/brand';

/** Logo do restaurante; sem logo, mostra as iniciais na cor da marca. */
export default function BrandMark({ brand, size = 40, className = '' }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (brand?.logo) {
    return (
      <span className={`brandmark has-logo ${className}`} style={style}>
        <img src={brand.logo} alt={brand.name ? `Logo ${brand.name}` : 'Logo'} />
      </span>
    );
  }
  return (
    <span className={`brandmark ${className}`} style={style} aria-hidden="true">
      {initials(brand?.name)}
    </span>
  );
}
