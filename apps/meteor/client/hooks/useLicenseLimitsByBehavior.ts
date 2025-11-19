import type { LicenseBehavior, LicenseLimitKind } from '@rocket.chat/core-typings';

import { useLicense } from './useLicense';

type LicenseLimitsByBehavior = Record<LicenseBehavior, LicenseLimitKind[]>;

const validateWarnLimit = (max: number, currentValue: number, behavior: LicenseBehavior, extraCount = 0) => {
switch (behavior) {
case 'invalidate_license':
case 'prevent_installation':
case 'disable_modules':
case 'start_fair_policy':
default:
return currentValue > max;
case 'prevent_action':
return extraCount ? currentValue > max : currentValue >= max;
}
};

export const useLicenseLimitsByBehavior = () => {
	const result = useLicense({ loadValues: true });

	if (result.isPending || result.isError) {
		return null;
	}

	const { license, limits } = result.data;

	if (!license || !limits) {
		return null;
	}

	const keyLimits = Object.keys(limits) as Array<keyof typeof limits>;

	// Get the rule with the highest limit that applies to this key
	const rules = keyLimits
		.map((key) => {
			const rule = license.limits[key]
				?.filter((limit) => validateWarnLimit(limit.max, limits[key].value ?? 0, limit.behavior))
				.reduce<{
					max: number;
					behavior: LicenseBehavior;
				} | null>((maxLimit, currentLimit) => (!maxLimit || currentLimit.max > maxLimit.max ? currentLimit : maxLimit), null);

			if (!rule) {
				return undefined;
			}

			if (rule.max === 0) {
				return undefined;
			}

			if (rule.max === -1) {
				return undefined;
			}

			return [key, rule.behavior];
		})
		.filter(Boolean) as Array<[keyof typeof limits, LicenseBehavior]>;

	if (!rules.length) {
		return null;
	}

	// Group by behavior
	return rules.reduce((acc, [key, behavior]) => {
		if (!acc[behavior]) {
			acc[behavior] = [];
		}

		acc[behavior].push(key);

		return acc;
	}, {} as LicenseLimitsByBehavior);
};
