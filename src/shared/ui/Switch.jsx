export default function Switch({ id, checked, onChange, label, size }) {
  return (
    <label className={`switch ${size === 'lg' ? 'switch-lg' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true" />
      {label && <span className="switch-label">{label}</span>}
    </label>
  );
}
