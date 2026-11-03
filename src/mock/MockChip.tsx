import { useTools } from '../tools/store';
import { useMock } from './store';
import '../home/home.css';

/** Shown while a held "mock me here" spot is active: say so, and offer Clear or Save as mark. */
export function MockChip() {
  const pos = useMock((s) => s.pos);
  if (!pos) return null;
  const save = async () => {
    const t = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    await useTools.getState().addWaypoint({ position: pos, icon: 'flag', name: `Mock spot ${t}` });
    useMock.getState().clear();
  };
  return (
    <div className="mock-chip" data-testid="mock-chip" role="status">
      <span>Pretending you're here. Scent drift is from this spot.</span>
      <button data-testid="mock-save" onClick={() => void save()}>Save as mark</button>
      <button data-testid="mock-clear" onClick={() => useMock.getState().clear()}>Clear</button>
    </div>
  );
}
