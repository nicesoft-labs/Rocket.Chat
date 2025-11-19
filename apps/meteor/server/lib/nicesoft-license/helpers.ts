import { getCurrentLicense } from './cache';

const getPayload = () => getCurrentLicense();

export const isLicensed = (): boolean => getCurrentLicense().status === 'valid';

export const hasFeature = (featureId: string): boolean => {
        const state = getPayload();
        if (state.status !== 'valid') {
                return false;
        }

        return state.features.includes(featureId);
};

export const getLimit = (key: string): number | null => {
        const state = getPayload();
        if (state.status !== 'valid') {
                return null;
        }

        return state.limits[key] ?? null;
};
