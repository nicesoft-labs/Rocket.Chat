import { Meteor } from 'meteor/meteor';
import { generateKeyPairSync, sign } from 'crypto';

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
        persistLicenseToDatabase: jest.fn(),
        removeLicenseFromDatabase: jest.fn(),
}));

jest.mock('../../../notifications/server/lib/Notifications', () => ({
        streamAll: { emit: jest.fn() },
}));

jest.mock('../../../../server/lib/nicesoft-license/events', () => ({
        emitLicenseUpdated: jest.fn(),
}));

const { reloadLicense, getCurrentLicense } = jest.requireMock('../../../../server/lib/nicesoft-license');
const {
        persistLicenseToFile,
        removeLicenseFile,
        persistLicenseToDatabase,
        removeLicenseFromDatabase,
} = jest.requireMock('../../../../server/lib/nicesoft-license/storage');
const { streamAll } = jest.requireMock('../../../notifications/server/lib/Notifications');
const { emitLicenseUpdated } = jest.requireMock('../../../../server/lib/nicesoft-license/events');

const { privateKey, publicKey } = generateKeyPairSync('ed25519');

const canonicalize = (value: unknown): unknown => {
        if (Array.isArray(value)) {
                return value.map(canonicalize);
        }

        if (value && typeof value === 'object') {
                return Object.keys(value as Record<string, unknown>)
                        .sort()
                        .reduce((result, key) => {
                                (result as Record<string, unknown>)[key] = canonicalize(
                                        (value as Record<string, unknown>)[key],
                                );
                                return result;
                        }, {} as Record<string, unknown>);
        }

        return value;
};

const signLicense = (payload: Record<string, any>) => {
        const canonicalPayload = JSON.stringify(canonicalize(payload));
        const signature = sign(null, Buffer.from(canonicalPayload), privateKey).toString('base64');
        return { ...payload, signature };
};

const ORIGINAL_ENV = { ...process.env };

describe('nicesoft license API helpers', () => {
        const baseDocument = {
                product: 'rocket',
                edition: 'pro',
                tenant: 'acme',
                valid_from: '2024-01-01T00:00:00.000Z',
                valid_to: '2999-01-01T00:00:00.000Z',
                features: ['a', 'b'],
                limits: { users: 10 },
        };

        const signedDocument = signLicense(baseDocument);
        const validStatePayload = (({ signature, ...rest }) => rest)(signedDocument);

        const validState: LicenseState = {
                status: 'valid',
                valid: true,
                payload: validStatePayload,
                features: validStatePayload.features,
                limits: validStatePayload.limits,
                reason: null,
                source: 'file',
                filePath: '/tmp/license.json',
        };

        beforeAll(() => {
                process.env = {
                        ...process.env,
                        NICECHAT_LICENSE_PUBLIC_KEY: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
                };
        });

        afterAll(() => {
                process.env = { ...ORIGINAL_ENV };
        });

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
                                expires_in: null,
                                payload: expect.objectContaining({
                                        edition: null,
                                        product: null,
                                        valid_to: null,
                                        valid_from: null,
                                        features: [],
                                        limits: {},
                                }),
                        }),
                );
        });

        it('buildLicenseInfoResponse returns invalid reason', () => {
                const state: LicenseState = {
                        status: 'invalid',
                        valid: false,
                        payload: validStatePayload,
                        features: validStatePayload.features,
                        limits: validStatePayload.limits,
                        reason: 'invalid signature',
                        source: 'file',
                        filePath: '/tmp/license.json',
                };

                getCurrentLicense.mockReturnValue(state);

                const result = buildLicenseInfoResponse();
                expect(result.status).toBe('invalid');
                expect(result.reason).toBe('invalid signature');
                expect(result.source).toBe('file');
                expect(result.payload.edition).toBe(validStatePayload.edition);
        });

        it('buildLicenseInfoResponse returns valid state with computed expiration', () => {
                getCurrentLicense.mockReturnValue(validState);

                const result = buildLicenseInfoResponse();
                expect(result.status).toBe('valid');
                expect(result.payload.edition).toBe('pro');
                expect(result.payload.features).toEqual(['a', 'b']);
                expect(result.payload.limits).toEqual({ users: 10 });
                expect(result.payload.valid_to).toBe(validStatePayload.valid_to);
                expect(result.expires_in).not.toBeNull();
        });

        it('normalizeLicenseDocument throws on invalid JSON', () => {
                expect(() => normalizeLicenseDocument('not-json')).toThrowError(new Meteor.Error('error-invalid-license-json'));
        });

        it('normalizeLicenseDocument throws on invalid schema', () => {
                expect(() => normalizeLicenseDocument({ product: 'only-product' })).toThrowError(
                        new Meteor.Error('invalid-license-schema'),
                );
        });

        it('normalizeLicenseDocument throws on invalid signature', () => {
                const tampered = { ...signedDocument, signature: 'broken' };
                expect(() => normalizeLicenseDocument(tampered)).toThrowError(
                        new Meteor.Error('invalid-license-signature'),
                );
        });

        it('normalizeLicenseDocument throws on invalid dates', () => {
                const expired = signLicense({ ...baseDocument, valid_to: '2000-01-01T00:00:00.000Z' });
                expect(() => normalizeLicenseDocument(expired)).toThrowError(new Meteor.Error('invalid-license-dates'));
        });

        it('handleLicenseUpload persists, reloads and broadcasts', async () => {
                getCurrentLicense.mockReturnValue(validState);

                const response = await handleLicenseUpload({ license: signedDocument });

                expect(persistLicenseToFile).toHaveBeenCalledWith(expect.stringContaining('rocket'));
                expect(persistLicenseToDatabase).toHaveBeenCalled();
                expect(reloadLicense).toHaveBeenCalledTimes(1);
                expect(streamAll.emit).toHaveBeenCalledWith('licenseUpdated', response);
                expect(emitLicenseUpdated).toHaveBeenCalledWith(validState);
                expect(response.status).toBe('valid');
        });

        it('handleLicenseUpload rejects invalid JSON payloads', async () => {
                await expect(handleLicenseUpload('broken-json')).rejects.toThrow(
                        new Meteor.Error('error-invalid-license-json'),
                );
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
                expect(removeLicenseFromDatabase).toHaveBeenCalledTimes(1);
                expect(reloadLicense).toHaveBeenCalledTimes(1);
                expect(streamAll.emit).toHaveBeenCalledWith('licenseUpdated', response);
                expect(response.status).toBe('missing');
        });
});
