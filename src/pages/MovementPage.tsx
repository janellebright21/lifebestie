import { useState, useRef, useEffect, useCallback } from 'react';
import { Activity, CheckCircle2, Circle, Flame, Zap, Wind, ChevronDown, ChevronUp, Plus, Clock, Trophy, Calendar, X } from 'lucide-react';
import { Event, EventCategory } from '../lib/supabase';
import {
  EnergyLevel,
  MovementActivity,
  MOVEMENT_OPTIONS,
  TodayMovement,
  TIME_RANGES,
  TimeRange,
  activitiesForTimeRange,
  encodeMovementNotes,
  getWeeklyMovements,
  useMovement,
} from '../hooks/useMovement';


interface MovementPageProps {
  events: Event[];
  onAddEvent: (
    title: string,
    date: string,
    time: string,
    category?: EventCategory,
    location?: string,
    notes?: string
  ) => Promise<Event>;
  onUpdateEvent: (
    id: string,
    patch: Partial<Pick<Event, 'title' | 'event_date' | 'event_time' | 'category' | 'location' | 'notes'>>
  ) => Promise<void>;
}

// ─── Workout pose thumbnail + preview dialog ──────────────────────────────────

const WORKOUT_DEMO_SHEET = '/assets/exec/exec-3ad98760-df7f-4d2d-aba6-3fcf43915e1d.png';
const SHEET_COLS = 3;
const SHEET_ROWS = 3;

const THUMB_TILES: Record<string, { row: number; col: number; alt: string }> = {
  'low-walk':      { row: 0, col: 0, alt: 'Emma demonstrating a walk around the block' },
  'low-stretch':   { row: 0, col: 1, alt: 'Emma demonstrating a stretching routine' },
  'low-mobility':  { row: 0, col: 2, alt: 'Emma demonstrating a mobility routine' },
  'mod-bodyweight':{ row: 1, col: 0, alt: 'Emma demonstrating a bodyweight workout' },
  'mod-bands':     { row: 1, col: 1, alt: 'Emma demonstrating resistance band exercises' },
  'mod-fastwalk':  { row: 1, col: 2, alt: 'Emma demonstrating a fast walk' },
  'high-strength': { row: 2, col: 0, alt: 'Emma demonstrating a strength workout' },
  'high-cardio':   { row: 2, col: 1, alt: 'Emma demonstrating a cardio workout' },
  'high-full':     { row: 2, col: 2, alt: 'Emma demonstrating a full workout session' },
};

// ── SVG stick-figure helpers ──────────────────────────────────────────────────

const FIG_STROKE = '#6366f1';
const FIG_STROKE_WIDTH = 2.5;
const ARROW_COLOR = '#ec4899';
const GROUND_COLOR = '#cbd5e1';

function GroundLine({ y }: { y: number }) {
  return <line x1="10" y1={y} x2="90" y2={y} stroke={GROUND_COLOR} strokeWidth="1.5" strokeDasharray="3 3" />;
}

function ArrowUp({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
      <line x1={x} y1={y} x2={x} y2={y - 14} />
      <polyline points={`${x - 4},${y - 10} ${x},${y - 15} ${x + 4},${y - 10}`} />
    </g>
  );
}

function ArrowRight({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
      <line x1={x} y1={y} x2={x + 14} y2={y} />
      <polyline points={`${x + 10},${y - 4} ${x + 15},${y} ${x + 10},${y + 4}`} />
    </g>
  );
}

function ArrowCurved({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
      <path d={`M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`} />
      <polyline points={`${cx - r - 4},${cy - 3} ${cx - r},${cy} ${cx - r - 3},${cy + 4}`} />
    </g>
  );
}

// Standard standing stick figure at center-x, feet at groundY.
// Arms hang at the sides (matching the 'arms relaxed at your sides' cues);
// stance 'together' draws the feet touching for 'feet together' cues.
function StickStanding({ cx, groundY, label, titleId, descId, desc, stance = 'hip' }: {
  cx: number; groundY: number; label: string; titleId: string; descId: string; desc: string; stance?: 'hip' | 'together';
}) {
  const headR = 6;
  const headCy = groundY - 44;
  const neckY = groundY - 38;
  const hipY = groundY - 20;
  const footSpread = stance === 'together' ? 3 : 8;
  return (
    <g role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>{label}</title>
      <desc id={descId}>{desc}</desc>
      <circle cx={cx} cy={headCy} r={headR} stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" />
      <line x1={cx} y1={neckY} x2={cx} y2={hipY} stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} strokeLinecap="round" />
      <line x1={cx - 10} y1={groundY - 30} x2={cx + 10} y2={groundY - 30} stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} strokeLinecap="round" />
      <line x1={cx - 8} y1={groundY - 30} x2={cx - 10} y2={groundY - 14} stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} strokeLinecap="round" />
      <line x1={cx + 8} y1={groundY - 30} x2={cx + 10} y2={groundY - 14} stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} strokeLinecap="round" />
      <line x1={cx} y1={hipY} x2={cx - footSpread} y2={groundY} stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} strokeLinecap="round" />
      <line x1={cx} y1={hipY} x2={cx + footSpread} y2={groundY} stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} strokeLinecap="round" />
    </g>
  );
}

// ── Per-activity SVG stage diagrams ────────────────────────────────────────────

interface StageDiagram {
  label: string;
  alt: string;
  desc: string;
  svg: React.ReactNode;
}

interface WorkoutDemo {
  thumbAlt: string;
  stages: StageDiagram[];
  cues: string[];
  isSequence?: boolean;
}

const SAFETY_REMINDER = 'Use a comfortable range and stop if it hurts.';

function buildDemos(): Record<string, WorkoutDemo> {
  return {

    'low-walk': {
      thumbAlt: 'Emma demonstrating a walk around the block',
      stages: [
        {
          label: 'Stand tall',
          alt: 'Standing tall, feet hip-width apart, ready to walk',
          desc: 'Stand tall with feet hip-width apart, arms relaxed at your sides.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Stand tall: feet hip-width apart, ready to walk">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Stand tall" titleId="lw-s-t" descId="lw-s-d" desc="Standing tall, feet hip-width apart, arms at sides" />
            </svg>
          ),
        },
        {
          label: 'Step heel-first',
          alt: 'Stepping forward with heel landing first, opposite arm swinging',
          desc: 'Step forward landing on your heel, roll through the foot, swing the opposite arm forward.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Step heel-first with opposite arm swing">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={34} r={6} />
                <line x1={50} y1={40} x2={50} y2={58} />
                <line x1={50} y1={44} x2={62} y2={38} />
                <line x1={50} y1={44} x2={40} y2={52} />
                <line x1={50} y1={58} x2={60} y2={78} />
                <line x1={50} y1={58} x2={38} y2={78} />
              </g>
              <ArrowRight x={64} y={38} />
            </svg>
          ),
        },
        {
          label: 'Step through',
          alt: 'Bringing feet together, returning to standing posture',
          desc: 'Bring the back foot forward to meet the lead foot, return to tall standing.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Step through and return to tall standing">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Step through" titleId="lw-r-t" descId="lw-r-d" desc="Feet together, back to tall standing posture" stance="together" />
              <ArrowRight x={70} y={60} />
            </svg>
          ),
        },
      ],
      cues: ['Land heel-first, roll through to toe', 'Swing opposite arm to each step', 'Keep your gaze forward, chin level'],
    },

    'low-stretch': {
      thumbAlt: 'Emma demonstrating a stretching routine',
      stages: [
        {
          label: 'Stand tall',
          alt: 'Standing tall with feet shoulder-width apart, arms at sides',
          desc: 'Stand with feet shoulder-width apart, arms hanging naturally at your sides.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Stand tall with feet shoulder-width apart">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Stand tall" titleId="ls-s-t" descId="ls-s-d" desc="Standing tall, feet shoulder-width, arms at sides" />
            </svg>
          ),
        },
        {
          label: 'Reach overhead',
          alt: 'Reaching one arm overhead and leaning to the opposite side',
          desc: 'Raise one arm overhead and lean gently to the opposite side, feeling a stretch along your torso.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Reach overhead and lean gently to the side">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={46} cy={30} r={6} />
                <line x1={46} y1={36} x2={50} y2={58} />
                <line x1={48} y1={42} x2={58} y2={20} />
                <line x1={48} y1={42} x2={40} y2={50} />
                <line x1={50} y1={58} x2={42} y2={78} />
                <line x1={50} y1={58} x2={56} y2={78} />
              </g>
              <ArrowUp x={64} y={34} />
            </svg>
          ),
        },
        {
          label: 'Return upright',
          alt: 'Lowering the arm back to standing position',
          desc: 'Slowly straighten up and lower your arm back to the starting position.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Return upright and lower your arm">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Return upright" titleId="ls-r-t" descId="ls-r-d" desc="Back to standing tall, arm lowered" />
              <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
                <line x1={64} y1={50} x2={64} y2={62} />
                <polyline points={`${60},${58} ${64},${63} ${68},${58}`} />
              </g>
            </svg>
          ),
        },
      ],
      cues: ['Reach up and over, not back or forward', 'Keep both feet flat on the floor', 'Hold the stretch for 15-30 seconds'],
    },

    'low-mobility': {
      thumbAlt: 'Emma demonstrating a mobility routine',
      stages: [
        {
          label: 'Relax shoulders',
          alt: 'Standing relaxed with arms at sides, shoulders loose',
          desc: 'Stand relaxed with arms at your sides, shoulders loose and breathing easily.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Relax shoulders while standing with arms at sides">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Relax shoulders" titleId="lm-s-t" descId="lm-s-d" desc="Standing relaxed, arms at sides, shoulders loose" />
            </svg>
          ),
        },
        {
          label: 'Roll backward',
          alt: 'Shoulders rolling backward in a circular motion',
          desc: 'Roll both shoulders slowly backward in a circular motion, keeping arms relaxed.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Roll both shoulders backward in circles">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={34} r={6} />
                <line x1={50} y1={40} x2={50} y2={58} />
                <line x1={50} y1={44} x2={40} y2={50} />
                <line x1={50} y1={44} x2={60} y2={50} />
                <line x1={50} y1={58} x2={42} y2={78} />
                <line x1={50} y1={58} x2={58} y2={78} />
              </g>
              <ArrowCurved cx={40} cy={46} r={6} />
            </svg>
          ),
        },
        {
          label: 'Settle and reverse',
          alt: 'Shoulders settling back to neutral position',
          desc: 'Let your shoulders settle back to neutral, take a breath, and repeat in the other direction.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Settle shoulders to neutral, then reverse direction">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Settle and reverse" titleId="lm-r-t" descId="lm-r-d" desc="Shoulders settled, back to neutral standing" />
            </svg>
          ),
        },
      ],
      cues: ['Roll slowly — 5-10 repetitions each direction', 'Keep your arms loose, not tense', 'Move only within a pain-free range'],
    },

    'mod-bodyweight': {
      thumbAlt: 'Emma demonstrating a bodyweight workout',
      stages: [
        {
          label: 'Sit on chair',
          alt: 'Sitting upright on a chair with feet flat on the floor',
          desc: 'Sit upright on a sturdy chair with feet flat on the floor, hip-width apart.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Sit upright on a chair, feet flat on the floor">
              <GroundLine y={80} />
              <rect x="34" y="58" width="32" height="6" rx="2" fill="#e2e8f0" stroke={GROUND_COLOR} strokeWidth="1" />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={36} r={6} />
                <line x1={50} y1={42} x2={50} y2={58} />
                <line x1={50} y1={46} x2={40} y2={52} />
                <line x1={50} y1={46} x2={60} y2={52} />
                <line x1={50} y1={58} x2={36} y2={60} />
                <line x1={36} y1={60} x2={36} y2={80} />
                <line x1={50} y1={58} x2={62} y2={60} />
                <line x1={62} y1={60} x2={62} y2={80} />
              </g>
            </svg>
          ),
        },
        {
          label: 'Stand using heels',
          alt: 'Rising from the chair to standing, leaning slightly forward',
          desc: 'Lean slightly forward, press through your heels, and stand up fully.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Rise from the chair by pressing through your heels">
              <GroundLine y={80} />
              <rect x="34" y="58" width="32" height="6" rx="2" fill="#e2e8f0" stroke={GROUND_COLOR} strokeWidth="1" />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={48} cy={28} r={6} />
                <line x1={49} y1={34} x2={52} y2={58} />
                <line x1={52} y1={42} x2={42} y2={36} />
                <line x1={52} y1={42} x2={62} y2={36} />
                <line x1={52} y1={58} x2={44} y2={80} />
                <line x1={52} y1={58} x2={60} y2={80} />
              </g>
              <ArrowUp x={48} y={22} />
            </svg>
          ),
        },
        {
          label: 'Sit with control',
          alt: 'Lowering back down to the chair with control',
          desc: 'Lower yourself back down to the chair slowly and with control.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Lower back to the chair with control">
              <GroundLine y={80} />
              <rect x="34" y="58" width="32" height="6" rx="2" fill="#e2e8f0" stroke={GROUND_COLOR} strokeWidth="1" />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={28} r={6} />
                <line x1={50} y1={34} x2={50} y2={54} />
                <line x1={50} y1={40} x2={42} y2={46} />
                <line x1={50} y1={40} x2={58} y2={46} />
                <line x1={50} y1={54} x2={38} y2={64} />
                <line x1={38} y1={64} x2={38} y2={80} />
                <line x1={50} y1={54} x2={62} y2={64} />
                <line x1={62} y1={64} x2={62} y2={80} />
              </g>
              <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
                <line x1={50} y1={14} x2={50} y2={22} />
                <polyline points={`${46},${18} ${50},${23} ${54},${18}`} />
              </g>
            </svg>
          ),
        },
      ],
      cues: ['Press through heels, not toes', 'Keep your chest up and back straight', 'Aim for 8-12 slow repetitions'],
    },

    'mod-bands': {
      thumbAlt: 'Emma demonstrating resistance band exercises',
      stages: [
        {
          label: 'Hold the band',
          alt: 'Holding a resistance band with both hands at chest height, hands just wider than shoulder-width',
          desc: 'Hold a resistance band with both hands raised to chest height, hands just wider than your shoulders.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Hold the band with both hands at chest height">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={32} r={6} />
                <line x1={50} y1={38} x2={50} y2={58} />
                <line x1={50} y1={44} x2={32} y2={44} />
                <line x1={50} y1={44} x2={68} y2={44} />
                <line x1={50} y1={58} x2={42} y2={78} />
                <line x1={50} y1={58} x2={58} y2={78} />
              </g>
              <line x1={32} y1={44} x2={68} y2={44} stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 2" />
            </svg>
          ),
        },
        {
          label: 'Pull band apart',
          alt: 'Pulling hands apart, stretching the band outward',
          desc: 'Squeeze your shoulder blades and pull your hands apart, stretching the band outward.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Pull hands apart to stretch the band">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={32} r={6} />
                <line x1={50} y1={38} x2={50} y2={58} />
                <line x1={50} y1={44} x2={24} y2={40} />
                <line x1={50} y1={44} x2={76} y2={40} />
                <line x1={50} y1={58} x2={42} y2={78} />
                <line x1={50} y1={58} x2={58} y2={78} />
              </g>
              <line x1={24} y1={40} x2={76} y2={40} stroke="#f59e0b" strokeWidth="2.5" />
              <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
                <line x1={20} y1={40} x2={12} y2={40} />
                <polyline points={`${15},${36} ${10},${40} ${15},${44}`} />
                <line x1={80} y1={40} x2={88} y2={40} />
                <polyline points={`${85},${36} ${90},${40} ${85},${44}`} />
              </g>
            </svg>
          ),
        },
        {
          label: 'Return with control',
          alt: 'Bringing hands back together to starting position',
          desc: 'Slowly return your hands to the starting position, maintaining tension on the band.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Bring hands back to center with control">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={32} r={6} />
                <line x1={50} y1={38} x2={50} y2={58} />
                <line x1={50} y1={44} x2={36} y2={44} />
                <line x1={50} y1={44} x2={64} y2={44} />
                <line x1={50} y1={58} x2={42} y2={78} />
                <line x1={50} y1={58} x2={58} y2={78} />
              </g>
              <line x1={36} y1={44} x2={64} y2={44} stroke="#f59e0b" strokeWidth="2" strokeDasharray="2 2" />
              <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
                <line x1={28} y1={44} x2={34} y2={44} />
                <polyline points={`${30},${41} ${35},${44} ${30},${47}`} />
              </g>
            </svg>
          ),
        },
      ],
      cues: ['Lead with your elbows, not your hands', 'Squeeze shoulder blades together at the end', 'Keep wrists straight and tall posture'],
    },

    'mod-fastwalk': {
      thumbAlt: 'Emma demonstrating a fast walk',
      stages: [
        {
          label: 'Ready posture',
          alt: 'Standing tall with a slight forward lean, ready to walk briskly',
          desc: 'Stand tall with a slight forward lean from the ankles, ready to walk briskly.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Stand tall with a slight forward lean, ready to walk briskly">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={53} cy={32} r={6} />
                <line x1={53} y1={38} x2={50} y2={58} />
                <line x1={51} y1={44} x2={44} y2={54} />
                <line x1={51} y1={44} x2={58} y2={54} />
                <line x1={50} y1={58} x2={44} y2={78} />
                <line x1={50} y1={58} x2={56} y2={78} />
              </g>
            </svg>
          ),
        },
        {
          label: 'Brisk steps',
          alt: 'Walking briskly with bent elbows and active arm swing',
          desc: 'Walk with quick short steps, bend your elbows to 90 degrees, and pump your arms actively.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Walk briskly with bent elbows and active arm swing">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={32} r={6} />
                <line x1={50} y1={38} x2={50} y2={58} />
                <line x1={50} y1={42} x2={60} y2={38} />
                <line x1={60} y1={38} x2={64} y2={46} />
                <line x1={50} y1={42} x2={40} y2={48} />
                <line x1={40} y1={48} x2={36} y2={40} />
                <line x1={50} y1={58} x2={58} y2={78} />
                <line x1={50} y1={58} x2={40} y2={70} />
                <line x1={40} y1={70} x2={45} y2={78} />
              </g>
              <ArrowRight x={64} y={42} />
            </svg>
          ),
        },
        {
          label: 'Easy pace',
          alt: 'Slowing down to a normal walking pace',
          desc: 'Gradually slow your pace back to a comfortable walk, then stop and breathe.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Slow down to a comfortable walking pace">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Easy pace" titleId="fw-r-t" descId="fw-r-d" desc="Slowing down to normal walking pace" />
              <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
                <line x1={70} y1={58} x2={64} y2={58} />
                <polyline points={`${66},${55} ${62},${58} ${66},${61}`} />
              </g>
            </svg>
          ),
        },
      ],
      cues: ['Bend elbows to roughly 90 degrees', 'Take short quick steps, not long strides', 'Land mid-foot and push off the toes'],
    },

    'high-strength': {
      thumbAlt: 'Emma demonstrating a strength workout',
      stages: [
        {
          label: 'Feet hip-width',
          alt: 'Standing tall with feet hip-width, hands behind head, ready to hinge',
          desc: 'Stand tall with feet hip-width apart, hands lightly behind your head, core braced.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Stand hip-width apart, core braced, ready to hinge">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={32} r={6} />
                <line x1={50} y1={38} x2={50} y2={58} />
                <line x1={50} y1={40} x2={44} y2={34} />
                <line x1={50} y1={40} x2={56} y2={34} />
                <line x1={50} y1={58} x2={44} y2={78} />
                <line x1={50} y1={58} x2={56} y2={78} />
              </g>
            </svg>
          ),
        },
        {
          label: 'Hinge at hips',
          alt: 'Hinging forward at the hips with a flat back, upper body leaning forward',
          desc: 'Push your hips back and hinge forward at the waist with a flat back until your torso is nearly parallel to the floor.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Hinge forward at the hips with a flat back">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={24} cy={47} r={6} />
                <line x1={30} y1={48} x2={58} y2={58} />
                <line x1={36} y1={50} x2={29} y2={43} />
                <line x1={36} y1={50} x2={29} y2={45} />
                <line x1={58} y1={58} x2={50} y2={78} />
                <line x1={58} y1={58} x2={66} y2={78} />
              </g>
              <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
                <line x1={28} y1={36} x2={28} y2={24} />
                <polyline points={`${24},${28} ${28},${22} ${32},${28}`} />
              </g>
            </svg>
          ),
        },
        {
          label: 'Stand and squeeze',
          alt: 'Standing back up by driving hips forward to upright position',
          desc: 'Drive your hips forward and stand back up to the starting position, squeezing your glutes at the top.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Stand upright and squeeze your glutes">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={51} cy={32} r={6} />
                <line x1={51} y1={38} x2={50} y2={58} />
                <line x1={50} y1={40} x2={44} y2={34} />
                <line x1={50} y1={40} x2={56} y2={34} />
                <line x1={50} y1={58} x2={44} y2={78} />
                <line x1={50} y1={58} x2={56} y2={78} />
              </g>
              <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
                <line x1={62} y1={58} x2={54} y2={50} />
                <polyline points={`${54},${53} ${52},${48} ${57},${49}`} />
              </g>
            </svg>
          ),
        },
      ],
      cues: ['Hinge from the hips, do not round your back', 'Keep a slight bend in your knees throughout', 'Brace your core before each repetition'],
    },

    'high-cardio': {
      thumbAlt: 'Emma demonstrating a cardio workout',
      stages: [
        {
          label: 'Feet together',
          alt: 'Standing tall with feet together, arms at sides, ready to move',
          desc: 'Stand tall with feet together, arms at your sides, ready to move.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Stand with feet together, ready for step jacks">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Feet together" titleId="hc-s-t" descId="hc-s-d" desc="Standing tall, feet together, arms at sides" stance="together" />
            </svg>
          ),
        },
        {
          label: 'Step out, arms rise',
          alt: 'Stepping one foot out to the side while raising both arms overhead',
          desc: 'Step one foot out to the side while raising both arms overhead — a low-impact version of a jumping jack.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Step out to the side while raising both arms overhead">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={30} r={6} />
                <line x1={50} y1={36} x2={50} y2={58} />
                <line x1={50} y1={40} x2={38} y2={28} />
                <line x1={50} y1={40} x2={62} y2={28} />
                <line x1={50} y1={58} x2={44} y2={78} />
                <line x1={50} y1={58} x2={64} y2={78} />
              </g>
              <ArrowUp x={38} y={24} />
              <ArrowUp x={62} y={24} />
            </svg>
          ),
        },
        {
          label: 'Step in, arms lower',
          alt: 'Stepping foot back in and lowering arms to starting position',
          desc: 'Step the foot back in and lower your arms, then alternate sides with a steady rhythm.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Step back in and lower both arms">
              <GroundLine y={78} />
              <StickStanding cx={50} groundY={78} label="Step in, arms lower" titleId="hc-r-t" descId="hc-r-d" desc="Feet back together, arms lowered" stance="together" />
              <g stroke={ARROW_COLOR} strokeWidth="2" fill="none" strokeLinecap="round">
                <line x1={30} y1={74} x2={40} y2={74} />
                <polyline points={`${37},${71} ${42},${74} ${37},${77}`} />
              </g>
            </svg>
          ),
        },
      ],
      cues: ['Keep it low-impact — step, do not jump', 'Raise arms fully overhead each time', 'Maintain a steady, rhythmic pace'],
    },

    'high-full': {
      thumbAlt: 'Emma demonstrating a full workout session',
      isSequence: true,
      stages: [
        {
          label: '1. March',
          alt: 'Marching in place, lifting one knee to hip height',
          desc: 'March in place: lift one knee to hip height, lower it, then alternate legs.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="March: lifting one knee to hip height in place">
              <GroundLine y={78} />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={50} cy={32} r={6} />
                <line x1={50} y1={38} x2={50} y2={58} />
                <line x1={50} y1={44} x2={40} y2={52} />
                <line x1={50} y1={44} x2={59} y2={41} />
                <line x1={50} y1={58} x2={44} y2={78} />
                <line x1={50} y1={58} x2={60} y2={50} />
                <line x1={60} y1={50} x2={58} y2={64} />
              </g>
              <ArrowUp x={62} y={62} />
            </svg>
          ),
        },
        {
          label: '2. Chair Squat',
          alt: 'Standing up from a chair, pressing through heels',
          desc: 'Sit-to-stand from a chair: press through your heels and stand up fully, then lower with control.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Chair squat: rising from a chair to standing">
              <GroundLine y={80} />
              <rect x="34" y="58" width="32" height="6" rx="2" fill="#e2e8f0" stroke={GROUND_COLOR} strokeWidth="1" />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={48} cy={28} r={6} />
                <line x1={49} y1={34} x2={52} y2={58} />
                <line x1={52} y1={42} x2={42} y2={36} />
                <line x1={52} y1={42} x2={62} y2={36} />
                <line x1={52} y1={58} x2={44} y2={80} />
                <line x1={52} y1={58} x2={60} y2={80} />
              </g>
              <ArrowUp x={48} y={22} />
            </svg>
          ),
        },
        {
          label: '3. Wall Push-up',
          alt: 'Pushing against a wall with arms extended, body at a slight angle',
          desc: 'Wall push-up: place hands on a wall, lean in, then push back out keeping your body straight.',
          svg: (
            <svg viewBox="0 0 100 90" className="w-full h-full" role="img" aria-label="Wall push-up: pushing against a wall with arms">
              <line x1="20" y1="10" x2="20" y2="80" stroke={GROUND_COLOR} strokeWidth="3" />
              <g stroke={FIG_STROKE} strokeWidth={FIG_STROKE_WIDTH} fill="none" strokeLinecap="round">
                <circle cx={48} cy={30} r={6} />
                <line x1={48} y1={36} x2={52} y2={64} />
                <line x1={50} y1={42} x2={22} y2={50} />
                <line x1={50} y1={42} x2={22} y2={40} />
                <line x1={52} y1={64} x2={64} y2={78} />
                <line x1={52} y1={64} x2={44} y2={78} />
              </g>
              <ArrowRight x={56} y={42} />
            </svg>
          ),
        },
      ],
      cues: ['Do 30 seconds of each move, then rest', 'Keep good form over speed', 'Repeat the 3-move sequence 2-3 times'],
    },
  };
}

const WORKOUT_DEMOS = buildDemos();

function tileBgPosition(activityId: string): { bgX: number; bgY: number } | null {
  const tile = THUMB_TILES[activityId];
  if (!tile) return null;
  return {
    bgX: (tile.col / (SHEET_COLS - 1)) * 100,
    bgY: (tile.row / (SHEET_ROWS - 1)) * 100,
  };
}

function WorkoutPoseThumb({
  activityId,
  size = 40,
  onOpen,
}: {
  activityId: string;
  size?: number;
  onOpen: () => void;
}) {
  const tile = THUMB_TILES[activityId];
  const pos = tileBgPosition(activityId);
  if (!tile || !pos) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Preview demo: ${tile.alt}`}
      className="rounded-lg overflow-hidden shrink-0 border border-white/60 cursor-pointer hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-400"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${WORKOUT_DEMO_SHEET})`,
        backgroundSize: `${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%`,
        backgroundPosition: `${pos.bgX}% ${pos.bgY}%`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

function WorkoutPoseDialog({
  activity,
  onClose,
  restoreFocusRef,
}: {
  activity: MovementActivity;
  onClose: () => void;
  restoreFocusRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const demo = WORKOUT_DEMOS[activity.id];
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setStageIndex(i => Math.max(0, i - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setStageIndex(i => Math.min((demo?.stages.length ?? 1) - 1, i + 1));
    } else if (e.key === 'Tab') {
      // Keep keyboard focus inside the modal dialog.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialogRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialogRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onClose, demo]);

  const handleClose = useCallback(() => {
    onClose();
    restoreFocusRef.current?.focus();
  }, [onClose, restoreFocusRef]);

  if (!demo) return null;

  const stage = demo.stages[Math.min(stageIndex, demo.stages.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={handleClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`How-to preview: ${activity.label}`}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <p className="text-sm font-bold text-gray-700">{activity.label}</p>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={handleClose}
            aria-label="Close demo preview"
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            style={{ minHeight: 32, minWidth: 32 }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Emma reference photo */}
          <div className="flex items-center gap-3">
            <div
              role="img"
              aria-label={demo.thumbAlt}
              className="rounded-xl overflow-hidden border border-gray-100 shrink-0"
              style={{
                width: 56,
                height: 56,
                backgroundImage: `url(${WORKOUT_DEMO_SHEET})`,
                backgroundSize: `${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%`,
                backgroundPosition: tileBgPosition(activity.id)
                  ? `${tileBgPosition(activity.id)!.bgX}% ${tileBgPosition(activity.id)!.bgY}%`
                  : '0% 0%',
                backgroundRepeat: 'no-repeat',
              }}
            />
            <div>
              <p className="text-[11px] font-semibold text-gray-600">
                {demo.isSequence ? '3-move sequence' : 'Beginner how-to'}
              </p>
              <p className="text-[10px] text-gray-400">Emma shows you how</p>
            </div>
          </div>

          {/* Large current-stage diagram with step controls */}
          <div
            className="rounded-xl border border-gray-100 bg-slate-50/60 px-2 pt-3 pb-2"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="wpm-stage-num">{stageIndex + 1} / {demo.stages.length}</span>
              <span className="wpm-stage-label text-right">{stage.label}</span>
            </div>
            <div className="w-full aspect-[10/9] max-h-64 flex items-center justify-center">
              {stage.svg}
            </div>
            <p className="text-xs text-gray-600 text-center leading-snug px-2">{stage.desc}</p>
          </div>

          {/* Step controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setStageIndex(i => Math.max(0, i - 1))}
              disabled={stageIndex === 0}
              aria-label={`Previous step${demo.stages[stageIndex - 1] ? `: ${demo.stages[stageIndex - 1].label}` : ''}`}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 active:scale-95 transition-all"
              style={{ minHeight: 40, minWidth: 88 }}
            >
              ← Prev
            </button>
            <div className="flex gap-1.5" role="group" aria-label="Jump to step">
              {demo.stages.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={i === stageIndex}
                  aria-label={`Step ${i + 1}: ${s.label}`}
                  onClick={() => setStageIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === stageIndex ? 'bg-indigo-500' : 'bg-gray-300 hover:bg-gray-400'}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStageIndex(i => Math.min(demo.stages.length - 1, i + 1))}
              disabled={stageIndex === demo.stages.length - 1}
              aria-label={`Next step${demo.stages[stageIndex + 1] ? `: ${demo.stages[stageIndex + 1].label}` : ''}`}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 active:scale-95 transition-all"
              style={{ minHeight: 40, minWidth: 88 }}
            >
              Next →
            </button>
          </div>

          {/* All steps listed for quick reference */}
          <div className="space-y-1 pt-1 border-t border-gray-50">
            {demo.stages.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStageIndex(i)}
                className={`w-full text-left flex items-baseline gap-2 rounded-lg px-2 py-1.5 transition-colors ${i === stageIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              >
                <span className="wpm-stage-num">{i + 1}</span>
                <span className="text-[11px] text-gray-500 leading-snug">{s.desc}</span>
              </button>
            ))}
          </div>

          {/* Form cues */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-semibold text-gray-600">Form cues</p>
            {demo.cues.map((cue, i) => (
              <div key={i} className="wpm-cue-item">
                <span className="wpm-cue-bullet" />
                <span>{cue}</span>
              </div>
            ))}
          </div>

          {/* Safety reminder */}
          <p className="text-[10px] text-gray-400 italic text-center pt-1">
            {SAFETY_REMINDER}
          </p>
        </div>
      </div>
    </div>
  );
}

const LEVEL_ICONS: Record<EnergyLevel, React.ReactNode> = {
  low:      <Wind size={16} />,
  moderate: <Zap size={16} />,
  high:     <Flame size={16} />,
};

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ─── Activity card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  level,
  isAdded,
  isCompleted,
  onAdd,
  onComplete,
  onPreview,
}: {
  activity: MovementActivity;
  level: EnergyLevel;
  isAdded: boolean;
  isCompleted: boolean;
  onAdd: () => void;
  onComplete: () => void;
  onPreview: (activity: MovementActivity) => void;
}) {
  const { color } = MOVEMENT_OPTIONS[level];

  return (
    <div className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${color.bg} ${color.border}`}>
      <WorkoutPoseThumb activityId={activity.id} onOpen={() => onPreview(activity)} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${color.text}`}>{activity.label}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock size={10} className="text-gray-400" />
          <span className="text-xs text-gray-400">{activity.duration}</span>
        </div>
      </div>

      {isAdded ? (
        <button
          onClick={onComplete}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
            isCompleted
              ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
              : `${color.bg} ${color.text} border ${color.border} hover:opacity-80`
          }`}
        >
          {isCompleted
            ? <><CheckCircle2 size={13} /> Done</>
            : <><Circle size={13} /> Mark done</>
          }
        </button>
      ) : (
        <button
          onClick={onAdd}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${color.bg} ${color.text} ${color.border} hover:opacity-80`}
        >
          <Plus size={13} />
          Add
        </button>
      )}
    </div>
  );
}

// ─── Energy level section ─────────────────────────────────────────────────────

function EnergySection({
  level,
  todayMovements,
  onAdd,
  onComplete,
  onPreview,
}: {
  level: EnergyLevel;
  todayMovements: TodayMovement[];
  onAdd: (activity: MovementActivity) => void;
  onComplete: (movement: TodayMovement) => void;
  onPreview: (activity: MovementActivity) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const opts = MOVEMENT_OPTIONS[level];
  const { color } = opts;

  const addedForLevel = todayMovements.filter((m) => m.level === level);

  return (
    <div className={`rounded-2xl border ${color.bg} ${color.border} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color.badge}`}>
            <span className={color.icon}>{LEVEL_ICONS[level]}</span>
          </div>
          <div className="text-left">
            <p className={`text-sm font-bold ${color.text}`}>{opts.label}</p>
            <p className="text-xs text-gray-400">{opts.duration} · {opts.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {addedForLevel.length > 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color.badge}`}>
              {addedForLevel.filter((m) => m.done).length}/{addedForLevel.length} done
            </span>
          )}
          <span className={color.icon}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {/* Activities */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {opts.activities.map((activity) => {
            const addedMovement = addedForLevel.find((m) => m.activityLabel === activity.label);
            return (
              <ActivityCard
                key={activity.id}
                activity={activity}
                level={level}
                isAdded={!!addedMovement}
                isCompleted={addedMovement?.done ?? false}
                onAdd={() => onAdd(activity)}
                onComplete={() => addedMovement && onComplete(addedMovement)}
                onPreview={onPreview}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Today's movement summary ─────────────────────────────────────────────────

function TodaySummary({ todayMovements }: { todayMovements: TodayMovement[] }) {
  if (todayMovements.length === 0) return null;

  const done = todayMovements.filter((m) => m.done).length;
  const total = todayMovements.length;
  const allDone = done === total;

  return (
    <div className={`rounded-2xl border px-4 py-3.5 space-y-2 ${
      allDone ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-center gap-2">
        <Activity size={14} className={allDone ? 'text-emerald-500' : 'text-gray-400'} />
        <p className={`text-xs font-bold ${allDone ? 'text-emerald-700' : 'text-gray-600'}`}>
          {allDone ? "Great work! All movements done today." : `Today's movement — ${done}/${total} complete`}
        </p>
      </div>
      <div className="space-y-1.5">
        {todayMovements.map((m) => {
          const levelColor = MOVEMENT_OPTIONS[m.level].color;
          return (
            <div key={m.event.id} className="flex items-center gap-2">
              {m.done
                ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                : <Circle size={13} className="text-gray-300 shrink-0" />
              }
              <span className={`text-xs ${m.done ? 'text-gray-500' : 'text-gray-700'} ${m.done ? 'line-through' : ''}`}>
                {m.activityLabel}
              </span>
              <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${levelColor.badge}`}>
                {MOVEMENT_OPTIONS[m.level].label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── This week overview ───────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function WeeklyOverview({
  events,
  today,
  onAddFirst,
}: {
  events: Event[];
  today: string;
  onAddFirst: () => void;
}) {
  const { count, next } = getWeeklyMovements(events, today);

  if (count === 0) {
    return (
      <div
        className="rounded-2xl border px-4 py-4 text-center"
        style={{ borderColor: 'var(--theme-primary-mid)', background: 'var(--theme-primary-light)' }}
      >
        <p className="text-sm font-semibold text-gray-700">No movement planned this week</p>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          Even a short walk counts. Pick one to get started.
        </p>
        <button
          onClick={onAddFirst}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full text-white active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--theme-primary)', minHeight: 36 }}
        >
          <Plus size={13} />
          Add a workout
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <Calendar size={14} style={{ color: 'var(--theme-primary)' }} />
        <p className="text-xs font-bold text-gray-600">This week</p>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--theme-primary-light)', color: 'var(--theme-primary)' }}
        >
          {count} {count === 1 ? 'session' : 'sessions'}
        </span>
      </div>
      {next ? (
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--theme-primary-light)' }}
          >
            <Clock size={14} style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-700 truncate">{next.title}</p>
            <p className="text-xs text-gray-400">
              {formatDayLabel(next.date)}
              {next.time ? ` · ${next.time}` : ''}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">All sessions this week are past — nice work!</p>
      )}
    </div>
  );
}

// ─── Guided start ─────────────────────────────────────────────────────────────

function GuidedStart({
  selectedRange,
  onSelectRange,
  onAdd,
  onPreview,
}: {
  selectedRange: TimeRange | null;
  onSelectRange: (range: TimeRange | null) => void;
  onAdd: (activity: MovementActivity) => void;
  onPreview: (activity: MovementActivity) => void;
}) {
  const activities = selectedRange ? activitiesForTimeRange(selectedRange) : [];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Clock size={14} style={{ color: 'var(--theme-primary)' }} />
        <p className="text-xs font-bold text-gray-600">How much time do you have?</p>
        {selectedRange && (
          <button
            onClick={() => onSelectRange(null)}
            className="ml-auto text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            style={{ minHeight: 28, minWidth: 44 }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Time-range chips */}
      <div className="flex gap-2">
        {TIME_RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelectRange(r.id)}
            className={`flex-1 text-xs font-semibold px-3 py-2 rounded-xl border transition-all active:scale-95 ${
              selectedRange === r.id
                ? 'text-white'
                : 'bg-gray-50 border-gray-100 text-gray-500 hover:opacity-80'
            }`}
            style={
              selectedRange === r.id
                ? { backgroundColor: 'var(--theme-primary)', borderColor: 'var(--theme-primary)', minHeight: 36 }
                : { minHeight: 36 }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Filtered activities */}
      {selectedRange && (
        <div className="space-y-2 pt-1">
          {activities.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No activities in this range.</p>
          ) : (
            activities.map((activity) => {
              const color = MOVEMENT_OPTIONS[activity.energyLevel].color;
              return (
                <div
                  key={activity.id}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${color.bg} ${color.border}`}
                >
                  <WorkoutPoseThumb activityId={activity.id} onOpen={() => onPreview(activity)} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${color.text}`}>{activity.label}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={10} className="text-gray-400" />
                      <span className="text-xs text-gray-400">{activity.duration}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onAdd(activity)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${color.bg} ${color.text} ${color.border} hover:opacity-80`}
                  >
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MovementPage({ events, onAddEvent, onUpdateEvent }: MovementPageProps) {
  const { todayMovements, streakResult } = useMovement(events);
  const [adding, setAdding] = useState<string | null>(null);
  const [guidedRange, setGuidedRange] = useState<TimeRange | null>(null);
  const [previewActivity, setPreviewActivity] = useState<MovementActivity | null>(null);
  const lastFocusedThumbRef = useRef<HTMLButtonElement | null>(null);
  const activitiesRef = useRef<HTMLDivElement>(null);

  const openPreview = useCallback((activity: MovementActivity) => {
    const active = document.activeElement as HTMLButtonElement | null;
    if (active?.tagName === 'BUTTON') {
      lastFocusedThumbRef.current = active;
    }
    setPreviewActivity(activity);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewActivity(null);
  }, []);

  async function handleAdd(activity: MovementActivity) {
    if (adding === activity.id) return;
    setAdding(activity.id);
    try {
      await onAddEvent(
        activity.label,
        getToday(),
        getNow(),
        'Movement',
        undefined,
        encodeMovementNotes(activity.label, activity.energyLevel, false)
      );
    } finally {
      setAdding(null);
    }
  }

  async function handleComplete(movement: TodayMovement) {
    const updatedNotes = encodeMovementNotes(movement.activityLabel, movement.level, !movement.done);
    await onUpdateEvent(movement.event.id, { notes: updatedNotes });
  }

  const levels: EnergyLevel[] = ['low', 'moderate', 'high'];

  return (
    <div className="min-h-[100dvh] theme-app-bg pb-32">
      {/* Header */}
      <div className="border-b px-4 pt-12 pb-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="max-w-2xl mx-auto flex items-center">
          <div className="flex-1 min-w-0">
            <h1 className="bl-page-title leading-none">Movement</h1>
            <p className="text-xs text-gray-400 mt-0.5">Pick what fits your energy today</p>
          </div>
          {streakResult.streak > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-1.5 shrink-0">
              <Trophy size={12} className="text-amber-500" />
              <span className="text-xs font-bold text-amber-600">{streakResult.streak}d</span>
            </div>
          )}
        </div>
        {streakResult.streak > 0 && (
          <div className="max-w-2xl mx-auto mt-2 px-0.5">
            <p className="text-xs text-amber-600 font-medium">{streakResult.message}</p>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Today summary */}
        <TodaySummary todayMovements={todayMovements} />

        {/* This week overview */}
        <WeeklyOverview
          events={events}
          today={getToday()}
          onAddFirst={() => {
            activitiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />

        {/* Guided start */}
        <GuidedStart
          selectedRange={guidedRange}
          onSelectRange={setGuidedRange}
          onAdd={handleAdd}
          onPreview={openPreview}
        />

        {/* Energy level sections */}
        <div ref={activitiesRef} className="space-y-4">
        {levels.map((level) => (
          <EnergySection
            key={level}
            level={level}
            todayMovements={todayMovements}
            onAdd={handleAdd}
            onComplete={handleComplete}
            onPreview={openPreview}
          />
        ))}
        </div>

        {/* Tip */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
          <Flame size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Any movement counts. Even 5 minutes of stretching is better than none — consistency beats intensity every time.
          </p>
        </div>
      </div>

      {/* Pose demo dialog */}
      {previewActivity && (
        <WorkoutPoseDialog
          activity={previewActivity}
          onClose={closePreview}
          restoreFocusRef={lastFocusedThumbRef}
        />
      )}
    </div>
  );
}
