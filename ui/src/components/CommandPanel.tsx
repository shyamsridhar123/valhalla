import { useState, useCallback, type CSSProperties } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { useValhalla } from '../hooks/useValhalla';
import { useValhallaStore } from '../store/useValhallaStore';
import { colors, fonts, layerColors, NODE_NAMES } from '../theme';

type CommandType = 'message' | 'content' | 'crdt' | 'disconnect' | 'connect';

const COMMANDS: { type: CommandType; label: string; icon: string; layer: string }[] = [
  { type: 'message', label: 'Send Message', icon: '\u2709', layer: 'veil' },
  { type: 'content', label: 'Publish', icon: '\u2301', layer: 'saga' },
  { type: 'crdt', label: 'Set CRDT', icon: '\u21c4', layer: 'realm' },
  { type: 'disconnect', label: 'Disconnect', icon: '\u2702', layer: 'bifrost' },
  { type: 'connect', label: 'Connect', icon: '\u26a1', layer: 'bifrost' },
];

export function CommandPanel() {
  // State for selected command, form fields, loading, result
  const [activeCmd, setActiveCmd] = useState<CommandType | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const nodes = useValhallaStore(s => s.nodes);
  const { sendMessage, publishContent, setCRDT, disconnectPair, connectPair } = useValhalla();

  // Form state
  const [src, setSrc] = useState(0);
  const [dst, setDst] = useState(1);
  const [msgText, setMsgText] = useState('Hello from the sandbox!');
  const [contentData, setContentData] = useState('Sample content');
  const [contentTitle, setContentTitle] = useState('my-doc');
  const [crdtKey, setCrdtKey] = useState('counter');
  const [crdtValue, setCrdtValue] = useState('1');

  const nodeCount = nodes.length || 6;

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      let res: Record<string, unknown> | null;
      switch (activeCmd) {
        case 'message':
          res = await sendMessage(src, dst, msgText);
          setResult(res ? `Delivered: ${res.from} -> ${res.to}` : 'Failed');
          break;
        case 'content':
          res = await publishContent(src, contentData, contentTitle);
          setResult(res ? `Published CID: ${(res.cid as string)?.slice(0, 20)}...` : 'Failed');
          break;
        case 'crdt':
          res = await setCRDT(src, crdtKey, crdtValue);
          setResult(res ? `Set ${res.key}=${res.value} (synced to ${res.synced_peers} peers)` : 'Failed');
          break;
        case 'disconnect':
          await disconnectPair(src, dst);
          setResult(`Disconnected node ${src} from node ${dst}`);
          break;
        case 'connect':
          await connectPair(src, dst);
          setResult(`Connected node ${src} to node ${dst}`);
          break;
      }
    } catch {
      setResult('Error executing command');
    }
    setLoading(false);
  }, [activeCmd, src, dst, msgText, contentData, contentTitle, crdtKey, crdtValue,
      sendMessage, publishContent, setCRDT, disconnectPair, connectPair]);

  // Helper for node select dropdown
  const NodeSelect = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          background: colors.surface1,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: 6,
          padding: '6px 8px',
          color: '#fff',
          fontSize: 13,
          fontFamily: fonts.mono,
        }}
      >
        {Array.from({ length: nodeCount }, (_, i) => (
          <option key={i} value={i}>{i} ({NODE_NAMES[i] || `Node ${i}`})</option>
        ))}
      </select>
    </div>
  );

  const inputStyle: CSSProperties = {
    background: colors.surface1,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: 6,
    padding: '6px 8px',
    color: '#fff',
    fontSize: 13,
    fontFamily: fonts.mono,
    width: '100%',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.borderSubtle}`,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>
          Interactive Commands
        </div>
        <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2 }}>
          Send real operations to the network
        </div>
      </div>

      {/* Command buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 6,
        padding: '12px 16px',
        flexShrink: 0,
      }}>
        {COMMANDS.map(cmd => (
          <m.button
            key={cmd.type}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setActiveCmd(activeCmd === cmd.type ? null : cmd.type);
              setResult(null);
            }}
            style={{
              background: activeCmd === cmd.type
                ? `${layerColors[cmd.layer]}20`
                : colors.surface1,
              border: `1px solid ${activeCmd === cmd.type ? layerColors[cmd.layer] : colors.borderDefault}`,
              borderRadius: 8,
              padding: '8px 4px',
              color: activeCmd === cmd.type ? layerColors[cmd.layer] : colors.textSecondary,
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 16 }}>{cmd.icon}</span>
            {cmd.label}
          </m.button>
        ))}
      </div>

      {/* Form area */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
        <AnimatePresence mode="wait">
          {activeCmd && (
            <m.div
              key={activeCmd}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              {/* Dynamic form fields */}
              {(activeCmd === 'message' || activeCmd === 'disconnect' || activeCmd === 'connect') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <NodeSelect value={src} onChange={setSrc} label="From Node" />
                  <NodeSelect value={dst} onChange={setDst} label="To Node" />
                </div>
              )}

              {activeCmd === 'message' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Message</label>
                  <input value={msgText} onChange={e => setMsgText(e.target.value)} style={inputStyle} placeholder="Type a message..." />
                </div>
              )}

              {(activeCmd === 'content' || activeCmd === 'crdt') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Node</label>
                  <select
                    value={src}
                    onChange={e => setSrc(Number(e.target.value))}
                    style={inputStyle}
                  >
                    {Array.from({ length: nodeCount }, (_, i) => (
                      <option key={i} value={i}>{i} ({NODE_NAMES[i] || `Node ${i}`})</option>
                    ))}
                  </select>
                </div>
              )}

              {activeCmd === 'content' && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Title</label>
                    <input value={contentTitle} onChange={e => setContentTitle(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Content</label>
                    <textarea value={contentData} onChange={e => setContentData(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                </>
              )}

              {activeCmd === 'crdt' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Key</label>
                    <input value={crdtKey} onChange={e => setCrdtKey(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Value</label>
                    <input value={crdtValue} onChange={e => setCrdtValue(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              )}

              {/* Submit button */}
              <m.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  background: loading ? colors.surface2 : `linear-gradient(135deg, ${layerColors[COMMANDS.find(c => c.type === activeCmd)?.layer || 'demo']}, ${layerColors[COMMANDS.find(c => c.type === activeCmd)?.layer || 'demo']}88)`,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Executing...' : 'Execute'}
              </m.button>

              {/* Result display */}
              <AnimatePresence>
                {result && (
                  <m.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      background: colors.surface1,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: colors.accentGreen,
                      fontFamily: fonts.mono,
                    }}
                  >
                    {result}
                  </m.div>
                )}
              </AnimatePresence>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
