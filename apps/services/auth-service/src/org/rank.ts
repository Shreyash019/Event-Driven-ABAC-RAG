import { DeptRank } from '@prisma/client';

/**
 * Ordinal ordering of the in-department role ladder (least → most senior). Mirrors the
 * `DeptRank` enum declaration order in schema.prisma. One place to change if the ladder grows.
 */
export const RANK_ORDER: DeptRank[] = [
  DeptRank.IC,
  DeptRank.LEAD,
  DeptRank.MANAGER,
  DeptRank.SENIOR_MANAGER,
  DeptRank.DIRECTOR,
  DeptRank.VP,
];

/** Numeric ordinal of a rank (higher = more senior). */
export function rankOrdinal(rank: DeptRank): number {
  return RANK_ORDER.indexOf(rank);
}

/**
 * Whether a membership at this rank inherits visibility of the department's descendants.
 * MANAGER and above do (this replaces the old `isManager` boolean).
 */
export function inheritsDescendants(rank: DeptRank): boolean {
  return rankOrdinal(rank) >= rankOrdinal(DeptRank.MANAGER);
}
