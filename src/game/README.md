# Coder 2 Playground: Game & Mechanics

This directory is exclusively for **Coder 2** (Game Systems Integrator).
Build your game logic, canvas components, or interactive mechanics here.

### Expected Integration Export:
Export your game screen as a component that accepts callbacks:

```typescript
export interface EncounterProps {
  missionId: string;
  onComplete: (badgeId: string) => void;
  onExit: () => void;
}
```
Mounted on route `/game`.
