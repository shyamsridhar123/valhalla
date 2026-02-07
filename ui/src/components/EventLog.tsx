import { useValhallaStore } from '../store/useValhallaStore';

const layerColors: Record<string, string> = {
  bifrost: '#9b59b6',
  yggdrasil: '#3498db',
  veil: '#2ecc71',
  saga: '#f1c40f',
  rune: '#e67e22',
  realm: '#e74c3c',
  demo: '#4a9eff',
};

export function EventLog() {
  const events = useValhallaStore((s) => s.events);
  const clearEvents = useValhallaStore((s) => s.clearEvents);

  const recent = events.slice(-100);

  return (
    <div
      style={{
        background: '#0d0d1a',
        border: '1px solid #ffffff15',
        borderRadius: 8,
        padding: 12,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ color: '#ccc', fontWeight: 700, fontSize: 14 }}>
          Event Log ({events.length})
        </span>
        <button
          onClick={clearEvents}
          style={{
            background: 'none',
            border: '1px solid #555',
            borderRadius: 4,
            color: '#888',
            padding: '2px 8px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Clear
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {recent.length === 0 ? (
          <span style={{ color: '#555' }}>No events yet...</span>
        ) : (
          recent.map((evt, i) => (
            <div key={i} style={{ color: '#ccc' }}>
              <span style={{ color: layerColors[evt.layer] || '#666' }}>
                [{evt.layer}]
              </span>{' '}
              <span style={{ color: '#aaa' }}>{evt.type}</span>
              {evt.data &&
                Object.entries(evt.data).map(([k, v]) => (
                  <span key={k} style={{ color: '#666' }}>
                    {' '}
                    {k}={v}
                  </span>
                ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
