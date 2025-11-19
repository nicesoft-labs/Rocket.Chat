import { SystemLogger } from '../../lib/logger/system';

import { getLimit, isLicensed } from './helpers';
import { emitLimitReached, emitLimitRestored, onLicenseChanged } from './events';

export type LimitCounter = () => Promise<number>;

type LimitState = {
        limit: number | null;
        count: number | null;
};

const limitCounters = new Map<string, LimitCounter>();
const limitStates = new Map<string, LimitState>();
const pendingEvaluations = new Map<string, Promise<LimitState>>();

const isLimitExceeded = ({ limit, count }: LimitState): boolean => {
        if (limit === null || count === null) {
                        return false;
        }

        return count >= limit;
};

const updateState = (key: string, nextState: LimitState): void => {
        const previousState = limitStates.get(key);
        const previouslyExceeded = previousState ? isLimitExceeded(previousState) : false;
        const currentlyExceeded = isLimitExceeded(nextState);

        if (previouslyExceeded !== currentlyExceeded) {
                if (currentlyExceeded) {
                        emitLimitReached(key);
                } else {
                        emitLimitRestored(key);
                }
        }

        limitStates.set(key, nextState);
};

const getNumericLimit = (key: string): number | null => {
        if (!isLicensed()) {
                return null;
        }

        const value = getLimit(key);
        return typeof value === 'number' ? value : null;
};

const evaluateLimit = async (key: string, { force } = { force: false }): Promise<LimitState> => {
        if (!force) {
                const pending = pendingEvaluations.get(key);
                if (pending) {
                        return pending;
                }
        }

        const promise = (async (): Promise<LimitState> => {
                const limit = getNumericLimit(key);

                if (limit === null) {
                        const state = { limit: null, count: null };
                        updateState(key, state);
                        return state;
                }

                const counter = limitCounters.get(key);

                if (!counter) {
                        SystemLogger.warn(`No limit counter registered for ${key}`);
                        const state = { limit: null, count: null };
                        updateState(key, state);
                        return state;
                }

                try {
                        const count = await counter();
                        const state = { limit, count };
                        updateState(key, state);
                        return state;
                } catch (error) {
                        SystemLogger.error({ msg: `Failed to evaluate limit ${key}`, err: error });
                        const state = { limit: null, count: null };
                        updateState(key, state);
                        return state;
                }
        })();

        pendingEvaluations.set(key, promise);

        try {
                return await promise;
        } finally {
                const pending = pendingEvaluations.get(key);
                if (pending === promise) {
                        pendingEvaluations.delete(key);
                }
        }
};

const reevaluateAllLimits = async (): Promise<void> => {
        await Promise.all(Array.from(limitCounters.keys()).map((key) => evaluateLimit(key, { force: true }).catch(() => undefined)));
};

onLicenseChanged(() => {
        void reevaluateAllLimits();
});

export const registerLimitCounter = (key: string, counter: LimitCounter): void => {
        limitCounters.set(key, counter);
        void evaluateLimit(key);
};

export const shouldPreventAction = async (key: string, extraCount = 0): Promise<boolean> => {
        const { limit, count } = await evaluateLimit(key);

        if (limit === null || count === null) {
                return false;
        }

        return count + extraCount >= limit;
};

export const getLimitState = async (key: string): Promise<LimitState> => evaluateLimit(key);
