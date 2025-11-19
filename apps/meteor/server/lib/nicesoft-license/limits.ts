import { Users } from '@rocket.chat/models';

import { getLimit, isLicensed } from './helpers';

type LimitKind = 'activeUsers' | 'guestUsers';

type LimitInfo = {
        limit: number | null;
        count: number | null;
};

const getNumericLimit = (key: LimitKind): number | null => {
        if (!isLicensed()) {
                return null;
        }

        const value = getLimit(key);
        return typeof value === 'number' ? value : null;
};

const buildLimitInfo = async (key: LimitKind, counter: () => Promise<number>): Promise<LimitInfo> => {
        const limit = getNumericLimit(key);

        if (limit === null) {
                return {
                        limit: null,
                        count: null,
                };
        }

        const count = await counter();

return {
limit,
count,
};
};

export const getActiveUsersLimitInfo = async (): Promise<LimitInfo> =>
        buildLimitInfo('activeUsers', () => Users.getActiveLocalUserCount());

export const getGuestUsersLimitInfo = async (): Promise<LimitInfo> =>
        buildLimitInfo('guestUsers', () => Users.getActiveLocalGuestCount());

export const isActiveUsersLimitReached = async (): Promise<boolean> => {
        const { limit, count } = await getActiveUsersLimitInfo();

        if (limit === null || count === null) {
                return false;
        }

        return count >= limit;
};

export const isGuestUsersLimitReached = async (): Promise<boolean> => {
        const { limit, count } = await getGuestUsersLimitInfo();

        if (limit === null || count === null) {
                return false;
        }

        return count >= limit;
};
