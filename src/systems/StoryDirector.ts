import { WorldId } from '../data/schema.ts';
import { ALL_ENTRIES } from '../data/entries.ts';
import { GameState } from '../core/GameState.ts';
import { STORY, VoiceLine, fill, getAnswer, getFactPool, getSiteStory } from '../data/story.ts';
import { Unit7Voice } from '../ui/Unit7Voice.ts';

export interface StoryContext {
  world: WorldId;
  moving: boolean;
  /** UI overlays (entry reader, archive…) are open: stay quiet. */
  blocked: boolean;
  activeId: string | null;
  activeDist: number;
  /** Distance to every marker by id. */
  distances: Map<string, number>;
}

// Session memory survives scene restarts so UNIT-7 doesn't repeat itself
const spoken = new Set<string>();
const passed = new Set<string>();
const echoBand = new Map<string, number>();

type AmbientKind = 'why' | 'fact' | 'drive' | 'callback';
const AMBIENT_CYCLE: AmbientKind[] = ['why', 'fact', 'drive', 'callback', 'fact', 'why', 'drive', 'fact'];

/**
 * Decides when UNIT-7 speaks while exploring: arrival, echo approach, passing
 * recovered machines, idle moments, reflections on why humans explore, sourced
 * facts, and callbacks to the player's own journal answers.
 */
export class StoryDirector {
  private voice: Unit7Voice;
  private gap = 7; // seconds of quiet before the first line
  private ambientTimer = 0;
  private ambientInterval = 32;
  private idle = 0;
  private cycle = 0;
  private pendingAfterthought: string | null = null;

  constructor(voice: Unit7Voice) {
    this.voice = voice;
  }

  /** Called when the player returns to the surface after recovering a site. */
  queueAfterthought(siteId: string): void {
    if (GameState.isEntryRecovered(siteId) && !spoken.has(`after:${siteId}`)) {
      this.pendingAfterthought = siteId;
      this.gap = Math.min(this.gap, 1.2);
    }
  }

  /** The player asked UNIT-7 to talk ([Q] or clicking the robot). */
  requestThought(world: WorldId): void {
    const line = this.pickCallback() ?? this.pickPool('why', STORY.ambient.why) ?? this.pickPool(`${world}_idle`, STORY.ambient[`${world}_idle`]);
    if (line) {
      this.voice.say(line);
      this.ambientTimer = 0;
    }
  }

  update(dt: number, ctx: StoryContext): void {
    this.idle = ctx.moving ? 0 : this.idle + dt;
    if (ctx.blocked) return;
    this.ambientTimer += dt;
    if (this.voice.busy) {
      this.gap = 5;
      return;
    }
    this.gap -= dt;
    if (this.gap > 0) return;

    const line = this.choose(ctx);
    if (line) {
      this.voice.say(line);
      spoken.add(line.key);
    }
  }

  private choose(ctx: StoryContext): VoiceLine | null {
    // 1. Reflection on the site just recovered
    if (this.pendingAfterthought) {
      const id = this.pendingAfterthought;
      this.pendingAfterthought = null;
      spoken.add(`after:${id}`);
      const site = getSiteStory(id);
      if (site) {
        const answer = getAnswer(id);
        if (answer) {
          // Follow up with how the player's answer shapes UNIT-7's thinking
          this.voice.say({ key: `after:${id}`, text: site.afterthought, kind: 'thought', title: site.title });
          return { key: `reply:${id}`, text: STORY.motives[answer.motive].callback, kind: 'thought', title: 'JOURNAL' };
        }
        return { key: `after:${id}`, text: site.afterthought, kind: 'thought', title: site.title };
      }
    }

    // 2. First steps on a world
    const firstKey = `first_${ctx.world}` as const;
    if (!spoken.has(firstKey) && GameState.getRecoveredCount(ctx.world) === 0) {
      spoken.add(firstKey);
      const lines = STORY.ambient[firstKey];
      lines.slice(1).forEach((t, i) => this.voice.say({ key: `${firstKey}:${i + 1}`, text: t, kind: 'thought' }));
      return { key: `${firstKey}:0`, text: lines[0], kind: 'thought' };
    }

    // 3. Approaching the active echo
    if (ctx.activeId) {
      const band = echoBand.get(ctx.activeId) ?? 0;
      const site = getSiteStory(ctx.activeId);
      if (ctx.activeDist < 190 && band < 2 && site) {
        echoBand.set(ctx.activeId, 2);
        return { key: `approach:${ctx.activeId}`, text: site.approach, kind: 'thought', title: 'ECHO' };
      }
      if (ctx.activeDist < 460 && band < 1) {
        echoBand.set(ctx.activeId, 1);
        return this.pickPool('echo_far', STORY.ambient.echo_far, true);
      }
    }

    // 4. Passing a machine whose story is already recovered
    for (const [id, d] of ctx.distances) {
      if (d > 120 || passed.has(id) || !GameState.isEntryRecovered(id)) continue;
      passed.add(id);
      const entry = ALL_ENTRIES[id];
      if (!entry) continue;
      const pool = entry.status === 'active' ? STORY.ambient.passing_active : STORY.ambient.passing;
      const t = pool[Math.floor(Math.random() * pool.length)];
      return { key: `pass:${id}`, text: fill(t, { name: entry.name }), kind: 'thought' };
    }

    // 5. Standing still: look around, look up
    if (this.idle > 9 && this.ambientTimer > 14) {
      this.ambientTimer = 0;
      return this.pickPool(`${ctx.world}_idle`, STORY.ambient[`${ctx.world}_idle`], true);
    }

    // 6. Ambient rotation while exploring
    if (this.ambientTimer >= this.ambientInterval) {
      this.ambientTimer = 0;
      this.ambientInterval = 34 + Math.random() * 18;
      for (let tries = 0; tries < AMBIENT_CYCLE.length; tries++) {
        const kind = AMBIENT_CYCLE[this.cycle++ % AMBIENT_CYCLE.length];
        const line = this.pickAmbient(kind, ctx.world);
        if (line) return line;
      }
    }
    return null;
  }

  private pickAmbient(kind: AmbientKind, world: WorldId): VoiceLine | null {
    switch (kind) {
      case 'why':
        return this.pickPool('why', STORY.ambient.why);
      case 'drive':
        return this.pickPool(`${world}_drive`, STORY.ambient[`${world}_drive`]);
      case 'fact': {
        const pool = getFactPool(world).filter((l) => !spoken.has(l.key));
        if (!pool.length) return null;
        return pool[Math.floor(Math.random() * pool.length)];
      }
      case 'callback':
        return this.pickCallback();
    }
  }

  /** Quote one of the player's journal answers back and reflect on it. */
  private pickCallback(): VoiceLine | null {
    const answered = Object.keys(GameState.getJournal())
      .map((id) => ({ id, a: getAnswer(id) }))
      .filter((x) => x.a && !spoken.has(`callback:${x.id}`));
    if (!answered.length) return null;
    const pick = answered[Math.floor(Math.random() * answered.length)];
    const a = pick.a!;
    const site = getSiteStory(pick.id);
    return {
      key: `callback:${pick.id}`,
      text: `At ${site?.title ?? 'that site'}, you told me: "${a.text}" ${STORY.motives[a.motive].callback}`,
      kind: 'thought',
      title: 'JOURNAL',
    };
  }

  /** Random unspoken line from a pool; recycles the pool once exhausted. */
  private pickPool(prefix: string, pool: string[], allowRepeat = false): VoiceLine | null {
    let options = pool.map((t, i) => ({ key: `${prefix}:${i}`, text: t })).filter((o) => !spoken.has(o.key));
    if (!options.length) {
      if (!allowRepeat && prefix !== 'why') return null;
      pool.forEach((_t, i) => spoken.delete(`${prefix}:${i}`));
      options = pool.map((t, i) => ({ key: `${prefix}:${i}`, text: t }));
    }
    const o = options[Math.floor(Math.random() * options.length)];
    return { key: o.key, text: o.text, kind: 'thought' };
  }
}
