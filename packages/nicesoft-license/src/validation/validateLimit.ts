import type { LicenseBehavior } from '@rocket.chat/core-typings';

export const validateWarnLimit = (max: number, value: number, behavior?: LicenseBehavior): boolean => {
        if (max === -1) {
                return false;
        }

        if (max === 0) {
                return false;
        }

        if (behavior && behavior !== 'prevent_action' && behavior !== 'warn') {
                return false;
        }

        return value >= max;
};
