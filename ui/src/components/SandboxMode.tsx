import { useValhallaStore } from '../store/useValhallaStore';
import { colors } from '../theme';
import { NetworkGraph } from './NetworkGraph';
import { CommandPanel } from './CommandPanel';
import { NodeInspector } from './NodeInspector';

export function SandboxMode() {
  const nodes = useValhallaStore(s => s.nodes);
  const selectedNode = useValhallaStore(s => s.selectedNode);
  const setSelectedNode = useValhallaStore(s => s.setSelectedNode);

  const selectedIndex = selectedNode
    ? nodes.findIndex(n => n.short_id === selectedNode)
    : -1;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Live network graph */}
      <div style={{ flex: '1 1 65%', position: 'relative', minWidth: 0 }}>
        <NetworkGraph />
      </div>

      {/* Right: Command panel or Node inspector */}
      <div style={{
        flex: '0 0 35%',
        maxWidth: 380,
        borderLeft: `1px solid ${colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: colors.surface0,
      }}>
        {selectedNode && selectedIndex >= 0 ? (
          <NodeInspector
            nodeIndex={selectedIndex}
            shortId={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        ) : (
          <CommandPanel />
        )}
      </div>
    </div>
  );
}
