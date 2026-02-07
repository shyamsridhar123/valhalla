import { m } from 'framer-motion';
import { layers as layerDefs, colors } from '../theme';

interface LayerActivityBarProps {
  activity: Record<string, boolean>;
}

export function LayerActivityBar({ activity }: LayerActivityBarProps) {
  const hasActivity = Object.values(activity).some(Boolean);

  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        padding: '8px 16px',
        borderTop: `1px solid ${colors.borderSubtle}`,
        background: colors.surface2,
      }}
    >
      {[...layerDefs].reverse().map((layer) => {
        const isActive = activity[layer.key] ?? false;

        return (
          <m.div
            key={layer.key}
            animate={
              isActive
                ? {
                    background: `${layer.color}30`,
                    borderColor: `${layer.color}60`,
                  }
                : {
                    background: 'rgba(255,255,255,0.02)',
                    borderColor: colors.borderSubtle,
                  }
            }
            transition={{ duration: 0.3 }}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
            }}
          >
            {/* Activity dot */}
            <m.div
              animate={
                isActive
                  ? {
                      scale: [1, 1.4, 1],
                      boxShadow: [
                        `0 0 0 0 ${layer.color}60`,
                        `0 0 8px 2px ${layer.color}40`,
                        `0 0 0 0 ${layer.color}60`,
                      ],
                    }
                  : { scale: 1 }
              }
              transition={
                isActive
                  ? { duration: 1, repeat: Infinity }
                  : { duration: 0.2 }
              }
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isActive ? layer.color : colors.textFaint,
                flexShrink: 0,
              }}
            />

            {/* Label */}
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? layer.color : colors.textDim,
                letterSpacing: 0.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {layer.name}
            </span>
          </m.div>
        );
      })}

      {/* Connectors between active adjacent layers */}
      {!hasActivity && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            background: 'transparent',
          }}
        />
      )}
    </div>
  );
}
