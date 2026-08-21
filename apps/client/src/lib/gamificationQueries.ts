export type GamificationFetchObservationSource = "live" | "cached" | "error";

interface GamificationFetchObservation {
  generation: number;
  source: GamificationFetchObservationSource | null;
}

const homeObservations = new Map<string, GamificationFetchObservation>();
const shopObservations = new Map<string, GamificationFetchObservation>();

const getObservation = (
  observations: Map<string, GamificationFetchObservation>,
  userId?: string,
): GamificationFetchObservation => userId
  ? observations.get(userId) ?? { generation: 0, source: null }
  : { generation: 0, source: null };

const recordObservation = (
  observations: Map<string, GamificationFetchObservation>,
  userId: string,
  source: GamificationFetchObservationSource,
) => {
  const previous = getObservation(observations, userId);
  const next = { generation: previous.generation + 1, source };
  observations.set(userId, next);
  return next;
};

/** In-memory only: persisted cache hydration never records a network success. */
export const getGamificationHomeFetchObservation = (userId?: string) =>
  getObservation(homeObservations, userId);

export const recordGamificationHomeFetchObservation = (
  userId: string,
  source: GamificationFetchObservationSource,
) => recordObservation(homeObservations, userId, source);

/** Dashboard cache seeding does not pass through this Shop network marker. */
export const getGamificationShopFetchObservation = (userId?: string) =>
  getObservation(shopObservations, userId);

export const recordGamificationShopFetchObservation = (
  userId: string,
  source: GamificationFetchObservationSource,
) => recordObservation(shopObservations, userId, source);
