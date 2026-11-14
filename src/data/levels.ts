import { LevelConfig } from './schema.ts';

const levelModules = import.meta.glob<LevelConfig>('../../data/levels/*.json', {
  eager: true,
  import: 'default',
});

export const ALL_LEVELS: Record<string, LevelConfig> = {};

for (const path in levelModules) {
  const level = levelModules[path];
  if (level && level.id) {
    ALL_LEVELS[level.id] = level;
  }
}

export function getLevelConfig(id: string): LevelConfig | undefined {
  return ALL_LEVELS[id];
}

export function hasLevelConfig(id: string): boolean {
  return id in ALL_LEVELS;
}

