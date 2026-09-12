import type React from 'react';

export type OrganId = 'liver' | 'kidney' | 'heart' | 'brain' | 'lungs';
export interface OrganVisualState { toxicityLevel: 'low' | 'moderate' | 'high'; score: number; highlighted?: boolean; }
export interface CinematicVisualProps {
  scrollProgress?: number;
  scrollContainer?: React.RefObject<HTMLElement | null> | HTMLElement | null;
  reducedMotion?: boolean;
  activeOrgan?: OrganId;
  organStates?: Partial<Record<OrganId, OrganVisualState>>;
  onProgressChange?: (progress: number, activeSectionIndex: number) => void;
  enablePointerParallax?: boolean;
  autoPlayAtMidpoint?: boolean;
  midpointThreshold?: number;
  autoPlayDuration?: number;
  className?: string;
  style?: React.CSSProperties;
}
