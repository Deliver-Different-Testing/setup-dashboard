interface PillProps {
  label: string
  selected: boolean
  onToggle: () => void
}

export function Pill({ label, selected, onToggle }: PillProps) {
  return (
    <span className={`pill ${selected ? 'selected' : ''}`} onClick={onToggle}>
      {label}
    </span>
  )
}
