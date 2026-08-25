export type RoadmapGeneralSong = { id: string; releaseDate: string; position: number };

const dayMilliseconds = 86_400_000;

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Expected an ISO release date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Expected a valid ISO release date.");
  }
  return date;
}

export function addRoadmapDays(date: string, days: number) {
  const next = parseDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function isRoadmapSongReleased(releaseDate: string, today: string) {
  return releaseDate <= today;
}

export function replanFutureRoadmap({ songs, cadenceDays, anchorPosition, today }: {
  songs: RoadmapGeneralSong[];
  cadenceDays: number;
  anchorPosition: number;
  today?: string;
}) {
  if (!Number.isInteger(cadenceDays) || cadenceDays <= 0) throw new Error("Cadence must be a positive integer.");
  const ordered = [...songs].sort((a, b) => a.position - b.position);
  const anchor = ordered.find((song) => song.position === anchorPosition);
  if (!anchor) throw new Error("Roadmap anchor was not found.");
  let futureOffset = 0;
  return ordered.map((song) => {
    if (song.position <= anchorPosition) return song;
    if (today && isRoadmapSongReleased(song.releaseDate, today)) return song;
    futureOffset += 1;
    return { ...song, releaseDate: addRoadmapDays(anchor.releaseDate, futureOffset * cadenceDays) };
  });
}

export function moveRoadmapSong({ songs, songId, direction, today, cadenceDays }: {
  songs: RoadmapGeneralSong[];
  songId: string;
  direction: -1 | 1;
  today: string;
  cadenceDays: number;
}) {
  const ordered = [...songs].sort((a, b) => a.position - b.position);
  const firstFutureIndex = ordered.findIndex((song) => !isRoadmapSongReleased(song.releaseDate, today));
  const currentIndex = ordered.findIndex((song) => song.id === songId);
  if (currentIndex < 0 || firstFutureIndex < 0 || currentIndex < firstFutureIndex) {
    throw new Error("Only unreleased songs can be reordered.");
  }
  const targetIndex = currentIndex + direction;
  if (targetIndex < firstFutureIndex || targetIndex >= ordered.length) throw new Error("Song cannot move further in that direction.");
  const futureDateSlots = ordered.slice(firstFutureIndex).map((song) => song.releaseDate);
  [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
  return ordered.map((song, index) => ({
    ...song,
    position: index + 1,
    releaseDate: index < firstFutureIndex ? song.releaseDate : futureDateSlots[index - firstFutureIndex]
  }));
}

/**
 * Reorders only within one Auto plan. The selected songs exchange their
 * existing General Roadmap slots, so unrelated plans and unassigned songs
 * remain exactly where they are and dates stay attached to positions.
 */
export function moveRoadmapAutoPlanSong({
  songs,
  songId,
  autoPlanId,
  direction,
  today
}: {
  songs: Array<RoadmapGeneralSong & { autoPlanId: string | null }>;
  songId: string;
  autoPlanId: string;
  direction: -1 | 1;
  today: string;
}) {
  const ordered = [...songs].sort((a, b) => a.position - b.position);
  const planIndexes = ordered
    .map((song, index) => ({ index, song }))
    .filter(({ song }) => song.autoPlanId === autoPlanId)
    .map(({ index }) => index);
  const currentIndex = ordered.findIndex((song) => song.id === songId);
  const planIndex = planIndexes.indexOf(currentIndex);
  if (currentIndex < 0 || planIndex < 0 || isRoadmapSongReleased(ordered[currentIndex].releaseDate, today)) {
    throw new Error("Only unreleased songs assigned to this Auto plan can be reordered.");
  }
  const targetPlanIndex = planIndex + direction;
  if (targetPlanIndex < 0 || targetPlanIndex >= planIndexes.length) {
    throw new Error("Song cannot move further within this Auto plan.");
  }

  const targetIndex = planIndexes[targetPlanIndex];
  const dateSlots = ordered.map((song) => song.releaseDate);
  [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
  return ordered.map((song, index) => ({
    ...song,
    position: index + 1,
    releaseDate: dateSlots[index]
  }));
}

export const roadmapDayMilliseconds = dayMilliseconds;
