import { Meteor } from 'meteor/meteor';

import {
        buildLicenseInfoResponse,
        handleLicenseDelete,
        handleLicenseUpload,
        normalizeLicenseDocument,
} from './nicesoftLicense';
import type { LicenseState } from '../../../../server/lib/nicesoft-license/types';

jest.mock('../../../../server/lib/nicesoft-license', () => ({
        reloadLicense: jest.fn(),
        getCurrentLicense: jest.fn(),
}));

jest.mock('../../../../server/lib/nicesoft-license/storage', () => ({
        persistLicenseToFile: jest.fn(),
        removeLicenseFile: jest.fn(),
}));

jest.mock('../../../notifications/server/lib/Notifications', () => ({
        streamAll: { emit: jest.fn() },
}));

jest.mock('../../../../server/lib/nicesoft-license/events', () => ({
        emitLicenseUpdated: jest.fn(),
}));

const { reloadLicense, getCurrentLicense } = jest.requireMock('../../../../server/lib/nicesoft-license');
const { persistLicenseToFile, removeLicenseFile } = jest.requireMock('../../../../server/lib/nicesoft-license/storage');
const { streamAll } = jest.requireMock('../../../notifications/server/lib/Notifications');

describe('nicesoft license API helpers', () => {
        const validDocument = {
                product: 'rocket',
                edition: 'pro',
                tenant: 'acme',
                valid_from: '2024-01-01T00:00:00.000Z',
                valid_to: '2999-01-01T00:00:00.000Z',
                features: ['a', 'b'],
                limits: { users: 10 },
        };

        beforeEach(() => {
                jest.clearAllMocks();
        });

        it('buildLicenseInfoResponse returns missing state with null fields', () => {
                const state: LicenseState = {
                        status: 'missing',
                        valid: false,
                        payload: null,
                        features: [],
                        limits: {},
                        reason: null,
                        source: undefined,
                        filePath: undefined,
                };

                getCurrentLicense.mockReturnValue(state);

                const result = buildLicenseInfoResponse();

                expect(result).toEqual(
                        expect.objectContaining({
                                status: 'missing',
                                source: null,
                                reason: null,
                                expiresAt: null,
                                edition: null,
                                tenant: null,
                        }),
                );
        });

        it('buildLicenseInfoResponse returns invalid reason', () => {
                const state: LicenseState = {
                        status: 'invalid',
                        valid: false,
                        payload: null,
                        features: [],
                        limits: {},
                        reason: 'invalid signature',
                        source: 'file',
                        filePath: '/tmp/license.json',
                };

                getCurrentLicense.mockReturnValue(state);

                const result = buildLicenseInfoResponse();
                expect(result.status).toBe('invalid');
                expect(result.reason).toBe('invalid signature');
                expect(result.source).toBe('file');
        });

        it('buildLicenseInfoResponse returns valid state with computed expiration', () => {
                const state: LicenseState = {
                        status: 'valid',
                        valid: true,
                        payload: validDocument,
                        features: validDocument.features,
                        limits: validDocument.limits,
                        reason: null,
                        source: 'file',
                        filePath: '/tmp/license.json',
                };

                getCurrentLicense.mockReturnValue(state);

                const result = buildLicenseInfoResponse();
                expect(result.status).toBe('valid');
                expect(result.edition).toBe('pro');
                expect(result.features).toEqual(['a', 'b']);
                expect(result.limits).toEqual({ users: 10 });
                expect(result.expiresAt).toBe(validDocument.valid_to);
                expect(result.expiresInSeconds).not.toBeNull();
        });

        it('normalizeLicenseDocument throws on invalid JSON', () => {
                expect(() => normalizeLicenseDocument('not-json')).toThrowError(Meteor.Error);
        });

        it('handleLicenseUpload persists, reloads and broadcasts', async () => {
                getCurrentLicense.mockReturnValue({
                        status: 'valid',
                        valid: true,
                        payload: validDocument,
                        features: validDocument.features,
                        limits: validDocument.limits,
                        reason: null,
                        source: 'file',
                        filePath: '/tmp/license.json',
                } satisfies LicenseState);

                const response = await handleLicenseUpload({ license: validDocument });

                expect(persistLicenseToFile).toHaveBeenCalledTimes(1);
                expect(reloadLicense).toHaveBeenCalledTimes(1);
                expect(streamAll.emit).toHaveBeenCalledWith('licenseUpdated', response);
                expect(response.status).toBe('valid');
        });

        it('handleLicenseDelete removes license and marks missing', async () => {
                getCurrentLicense.mockReturnValue({
                        status: 'missing',
                        valid: false,
                        payload: null,
                        features: [],
                        limits: {},
                        reason: null,
                        source: undefined,
                        filePath: undefined,
                } satisfies LicenseState);

                const response = await handleLicenseDelete();

                expect(removeLicenseFile).toHaveBeenCalledTimes(1);
                expect(reloadLicense).toHaveBeenCalledTimes(1);
                expect(response.status).toBe('missing');
        });
});
