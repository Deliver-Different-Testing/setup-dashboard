interface ToggleProps {
  on: boolean
  onToggle: () => void
}

export function Toggle({ on, onToggle }: ToggleProps) {
  return (
    <div className={`toggle-track ${on ? 'on' : ''}`} onClick={onToggle}>
      <div className="toggle-knob" />
    </div>
  )
}
