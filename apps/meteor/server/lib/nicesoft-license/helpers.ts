import { getCurrentLicense } from './cache';
import type { NicesoftLicenseDocument } from './types';

const getPayload = (): NicesoftLicenseDocument | undefined => getCurrentLicense().payload;

export const isLicensed = (): boolean => getCurrentLicense().valid;

export const hasFeature = (featureId: string): boolean => {
	const payload = getPayload();
	if (!payload?.features?.length) {
		return false;
	}

	return payload.features.includes(featureId);
};

export const getLimit = (key: string): number | null => {
	const payload = getPayload();
	if (!payload?.limits) {
		return null;
	}

	return payload.limits[key] ?? null;
};
