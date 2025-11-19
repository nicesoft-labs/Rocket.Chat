import { Meteor } from 'meteor/meteor';

import { API } from '../api';
import { reloadLicense, getCurrentLicense } from '../../../../server/lib/nicesoft-license';
import type { LicenseState } from '../../../../server/lib/nicesoft-license/types';
import { LicenseValidationError, parseLicensePayload } from '../../../../server/lib/nicesoft-license/validator';
import { persistLicenseToFile, removeLicenseFile } from '../../../../server/lib/nicesoft-license/storage';
import { emitLicenseUpdated } from '../../../../server/lib/nicesoft-license/events';
import notifications from '../../../notifications/server/lib/Notifications';
import type { NicesoftLicenseInfoResult } from '@rocket.chat/rest-typings';

const buildLicenseInfoResponse = (state: LicenseState = getCurrentLicense()): NicesoftLicenseInfoResult => {
        const expiresAt = state.payload?.valid_to ?? null;
        const expiresInSeconds = (() => {
                if (!expiresAt) {
                        return null;
                }

                const expiresDate = new Date(expiresAt);
                if (Number.isNaN(expiresDate.getTime())) {
                        return null;
                }

                return Math.max(0, Math.floor((expiresDate.getTime() - Date.now()) / 1000));
        })();

        return {
                status: state.status,
                source: state.source ?? null,
                reason: state.reason ?? null,
                expiresAt,
                expiresInSeconds,
                edition: state.payload?.edition ?? null,
                tenant: state.payload?.tenant ?? null,
                features: state.features ?? [],
                limits: state.limits ?? {},
        };
};

const broadcastLicenseUpdated = (state: LicenseState): void => {
        const payload = buildLicenseInfoResponse(state);
        emitLicenseUpdated(state);
        notifications.streamAll.emit('licenseUpdated', payload);
};

const extractLicensePayload = async (bodyParams: unknown, request?: Request): Promise<unknown> => {
        if (bodyParams && typeof bodyParams === 'object' && 'license' in (bodyParams as Record<string, any>)) {
                return (bodyParams as Record<string, any>).license;
        }

        if (bodyParams !== undefined && bodyParams !== null) {
                return bodyParams;
        }

        if (request) {
                const rawText = await request.text();
                if (rawText.trim()) {
                        return rawText;
                }
        }

        throw new Meteor.Error('error-invalid-license-json', 'License payload is required');
};

const normalizeLicenseDocument = (payload: unknown) => {
        try {
                const document = parseLicensePayload(payload);
                const serialized = JSON.stringify(document, null, 2);
                return { document, serialized };
        } catch (error: any) {
                if (error instanceof LicenseValidationError) {
                        const code =
                                error.kind === 'json' ? 'error-invalid-license-json' : 'error-invalid-license-schema';
                        throw new Meteor.Error(code, error.message);
                }

                throw error;
        }
};

const handleLicenseUpload = async (bodyParams: unknown, request?: Request): Promise<NicesoftLicenseInfoResult> => {
        const rawPayload = await extractLicensePayload(bodyParams, request);
        const normalized = normalizeLicenseDocument(rawPayload);

        await persistLicenseToFile(normalized.serialized);

        await reloadLicense();
        const state = getCurrentLicense();
        broadcastLicenseUpdated(state);

        return buildLicenseInfoResponse(state);
};

const handleLicenseDelete = async (): Promise<NicesoftLicenseInfoResult> => {
        await removeLicenseFile();

        await reloadLicense();
        const state = getCurrentLicense();
        broadcastLicenseUpdated(state);

        return buildLicenseInfoResponse(state);
};

API.v1.addRoute(
        'nicesoft.license.info',
        { authRequired: true, permissionsRequired: ['manage-licensed-features'] },
        {
                async get() {
                        return API.v1.success(buildLicenseInfoResponse());
                },
        },
);

API.v1.addRoute(
        'nicesoft.license.upload',
        { authRequired: true, permissionsRequired: ['manage-licensed-features'] },
        {
                async post() {
                        try {
                                const response = await handleLicenseUpload(this.bodyParams, this.request as Request);
                                return API.v1.success(response);
                        } catch (error: any) {
                                if (error instanceof Meteor.Error) {
                                        if (error.error === 'error-invalid-license-json' || error.error === 'error-invalid-license-schema') {
                                                return API.v1.failure(error.reason || error.error, error.error);
                                        }

                                        return API.v1.failure(error.reason || error.error);
                                }

                                return API.v1.internalError(error?.message ?? 'Failed to process license');
                        }
                },
        },
);

API.v1.addRoute(
        'nicesoft.license',
        { authRequired: true, permissionsRequired: ['manage-licensed-features'] },
        {
                async delete() {
                        try {
                                const response = await handleLicenseDelete();
                                return API.v1.success(response);
                        } catch (error: any) {
                                if (error instanceof Meteor.Error) {
                                        return API.v1.failure(error.reason || error.error, error.error);
                                }

                                return API.v1.internalError(error?.message ?? 'Failed to delete license file');
                        }
                },
        },
);

export {
        buildLicenseInfoResponse,
        extractLicensePayload,
        normalizeLicenseDocument,
        handleLicenseUpload,
        handleLicenseDelete,
};
