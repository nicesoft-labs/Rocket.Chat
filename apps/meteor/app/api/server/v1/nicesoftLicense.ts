import type { NicesoftLicenseDocument, NicesoftLicenseSource } from '@rocket.chat/core-typings';
import { Meteor } from 'meteor/meteor';
import { promises as fs } from 'fs';
import { dirname } from 'path';

import { reloadLicense, getCurrentLicense } from '../../../../server/lib/nicesoft-license';
import type { LicenseState } from '../../../../server/lib/nicesoft-license/types';
import { getLicenseFilePath } from '../../../../server/lib/nicesoft-license/storage';
import { API } from '../api';

type LicenseStatus = 'valid' | 'invalid' | 'missing';

type LicenseInfoResponse = {
        status: LicenseStatus;
        payload?: NicesoftLicenseDocument;
        expiresAt?: string;
        reason?: string;
        source?: NicesoftLicenseSource;
        filePath?: string;
};

const determineStatus = (state: LicenseState): LicenseStatus => {
        if (state.valid) {
                return 'valid';
        }

        if (!state.payload && (!state.reason || /no license|not loaded/i.test(state.reason))) {
                return 'missing';
        }

        return 'invalid';
};

const getLicenseInfo = (): LicenseInfoResponse => {
        const state = getCurrentLicense();
        return {
                status: determineStatus(state),
                payload: state.payload,
                expiresAt: state.payload?.valid_to,
                reason: state.reason,
                source: state.source,
                filePath: state.filePath,
        };
};

const tryParseJson = (value: string): string | null => {
        try {
                const parsed = JSON.parse(value);
                return JSON.stringify(parsed, null, 2);
        } catch (error) {
                return null;
        }
};

const decodeBase64 = (value: string): string => {
        try {
                return Buffer.from(value, 'base64').toString('utf-8');
        } catch (error) {
                throw new Meteor.Error('error-invalid-license-json', 'Invalid license payload provided');
        }
};

const normalizeLicensePayload = (payload: unknown): string => {
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
                return JSON.stringify(payload, null, 2);
        }

        if (typeof payload !== 'string' || !payload.trim()) {
                throw new Meteor.Error('error-invalid-license-json', 'License payload must be a JSON string or base64 value');
        }

        const trimmed = payload.trim();
        const direct = tryParseJson(trimmed);
        if (direct) {
                return direct;
        }

        const decoded = tryParseJson(decodeBase64(trimmed));
        if (decoded) {
                return decoded;
        }

        throw new Meteor.Error('error-invalid-license-json', 'License payload must be a valid JSON document');
};

const extractLicenseBody = (bodyParams: any): unknown => {
        if (!bodyParams) {
                return undefined;
        }

        if (typeof bodyParams === 'object' && 'license' in bodyParams) {
                return bodyParams.license;
        }

        return bodyParams;
};

API.v1.addRoute(
        'nicesoft.license.info',
        { authRequired: true, permissionsRequired: ['view-privileged-setting'] },
        {
                async get() {
                        return API.v1.success(getLicenseInfo());
                },
        },
);

API.v1.addRoute(
        'nicesoft.license.upload',
        { authRequired: true, permissionsRequired: ['edit-privileged-setting'] },
        {
                async post() {
                        const rawLicense = extractLicenseBody(this.bodyParams);

                        if (!rawLicense) {
                                return API.v1.failure('License payload is required', 'error-invalid-license-json');
                        }

                        let normalizedContent: string;
                        try {
                                normalizedContent = normalizeLicensePayload(rawLicense);
} catch (error) {
if (error instanceof Meteor.Error) {
return API.v1.failure(error.reason ?? error.error, error.error ?? 'error-invalid-license-json');
}

return API.v1.failure('Invalid license payload', 'error-invalid-license-json');
}

                        const filePath = getLicenseFilePath();

                        try {
                                await fs.mkdir(dirname(filePath), { recursive: true });
                                await fs.writeFile(filePath, normalizedContent, 'utf-8');
                        } catch (error) {
                                const message = error instanceof Error ? error.message : 'Failed to write license file';
                                return API.v1.internalError(message);
                        }

                        await reloadLicense();

                        return API.v1.success(getLicenseInfo());
                },
        },
);
