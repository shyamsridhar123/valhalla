import { motion } from 'framer-motion';

const layers = [
  { name: 'Realm', color: '#e74c3c', osi: 'Application (L7)', desc: 'P2P RPC, Pub/Sub, CRDT' },
  { name: 'Rune', color: '#e67e22', osi: 'Presentation (L6)', desc: 'Trust, attestations, capabilities' },
  { name: 'Saga', color: '#f1c40f', osi: 'Session (L5)', desc: 'Content addressing, intents' },
  { name: 'Veil', color: '#2ecc71', osi: 'Transport (L4)', desc: 'Encryption, stream mux' },
  { name: 'Yggdrasil', color: '#3498db', osi: 'Network (L3)', desc: 'Identity, DHT, routing' },
  { name: 'Bifrost', color: '#9b59b6', osi: 'Data Link (L2)', desc: 'Frame codec, transport' },
];

interface StackViewProps {
  activeLayer?: string;
}

export function StackView({ activeLayer }: StackViewProps) {
  return (
    <div style={{ display: 'flex', gap: 24, padding: 16 }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ color: '#ccc', marginBottom: 12 }}>Valhalla Stack</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {layers.map((layer, i) => (
            <motion.div
              key={layer.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{
                background:
                  activeLayer?.toLowerCase() === layer.name.toLowerCase()
                    ? layer.color
                    : `${layer.color}33`,
                border: `2px solid ${layer.color}`,
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: 16 }}>
                  {layer.name}
                </span>
                <span style={{ color: '#ccc', marginLeft: 12, fontSize: 13 }}>
                  {layer.desc}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h3 style={{ color: '#ccc', marginBottom: 12 }}>OSI Equivalent</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {layers.map((layer, i) => (
            <motion.div
              key={layer.osi}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{
                background: '#ffffff0a',
                border: '1px solid #ffffff20',
                borderRadius: 8,
                padding: '12px 16px',
                color: '#999',
                fontSize: 14,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {layer.osi}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
