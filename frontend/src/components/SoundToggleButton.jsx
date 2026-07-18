import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { toggleSoundEnabled, useSoundEnabled } from '../utils/soundManager';

export default function SoundToggleButton({
  className = 'btn secondary',
  activeLabel = 'Sonido activo',
  inactiveLabel = 'Sonido inactivo'
}) {
  const enabled = useSoundEnabled();

  const handleToggle = () => {
    toggleSoundEnabled();
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleToggle}
      aria-pressed={enabled}
      title={enabled ? 'Desactivar sonidos' : 'Activar sonidos'}
    >
      {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      {enabled ? activeLabel : inactiveLabel}
    </button>
  );
}