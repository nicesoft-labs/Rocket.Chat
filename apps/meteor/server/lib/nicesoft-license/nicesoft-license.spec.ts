import { promises as fs } from 'fs';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { generateKeyPairSync, sign } from 'crypto';

import { loadLicenseFromStorage } from './storage';
import { getCurrentLicense, reloadLicense } from './cache';
import { getLimit, hasFeature, isLicensed } from './helpers';

const ORIGINAL_ENV = { ...process.env };
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

const createLicense = () =>
        JSON.stringify(
                signLicense({
                        product: 'NiceChat',
                        edition: 'pro',
                        valid_from: '2024-01-01T00:00:00.000Z',
                        valid_to: '2025-01-01T00:00:00.000Z',
                        features: ['voice', 'federation'],
                        limits: {
                                seats: 100,
                        },
                }),
        );

describe('Nicesoft License Engine', () => {
        beforeEach(() => {
                process.env.NICECHAT_LICENSE_PUBLIC_KEY = publicKey.export({ format: 'pem', type: 'spki' }).toString();
        });

        afterEach(async () => {
                process.env = { ...ORIGINAL_ENV };
                await reloadLicense();
        });

        it('marks state as missing when no license is provided', async () => {
                delete process.env.NICECHAT_LICENSE_B64;
                delete process.env.NICECHAT_LICENSE_PATH;

                await reloadLicense();

                const state = getCurrentLicense();
                expect(state.status).toBe('missing');
                expect(isLicensed()).toBe(false);
                expect(hasFeature('voice')).toBe(false);
                expect(getLimit('seats')).toBeNull();
        });

        it('reads license from environment variable when NICECHAT_LICENSE_B64 is defined', async () => {
                const raw = createLicense();
                process.env.NICECHAT_LICENSE_B64 = Buffer.from(raw, 'utf-8').toString('base64');

		const result = await loadLicenseFromStorage();
		expect(result).not.toBeNull();
		expect(result?.source).toBe('env');
		expect(result?.content).toBe(raw);
	});

	it('reads license from file when environment variable is absent', async () => {
		delete process.env.NICECHAT_LICENSE_B64;
		const dir = await mkdtemp(join(tmpdir(), 'nicechat-license-'));
		const filePath = join(dir, 'license.json');
		await fs.writeFile(filePath, createLicense(), 'utf-8');
		process.env.NICECHAT_LICENSE_PATH = filePath;

		const result = await loadLicenseFromStorage();
		expect(result).not.toBeNull();
                expect(result?.source).toBe('file');
                expect(result?.content).toContain('NiceChat');
        });

        it('marks state as invalid when license JSON is malformed', async () => {
                process.env.NICECHAT_LICENSE_B64 = Buffer.from('{invalid}', 'utf-8').toString('base64');

                await reloadLicense();

                const state = getCurrentLicense();
                expect(state.status).toBe('invalid');
                expect(state.reason).toBeTruthy();
                expect(isLicensed()).toBe(false);
                expect(hasFeature('voice')).toBe(false);
                expect(getLimit('seats')).toBeNull();
        });

        it('marks state as invalid when license structure is incorrect', async () => {
                const malformed = JSON.stringify({ product: 'NiceChat', features: ['voice'] });
                process.env.NICECHAT_LICENSE_B64 = Buffer.from(malformed, 'utf-8').toString('base64');

                await reloadLicense();

                const state = getCurrentLicense();
                expect(state.status).toBe('invalid');
                expect(state.reason).toContain('edition');
                expect(isLicensed()).toBe(false);
        });

        it('exposes helper functions based on cached license payload', async () => {
                const raw = createLicense();
                process.env.NICECHAT_LICENSE_B64 = Buffer.from(raw, 'utf-8').toString('base64');

                await reloadLicense();

                expect(getCurrentLicense().status).toBe('valid');
                expect(isLicensed()).toBe(true);
                expect(hasFeature('voice')).toBe(true);
                expect(hasFeature('unknown')).toBe(false);
                expect(getLimit('seats')).toBe(100);
                expect(getLimit('storage')).toBeNull();

		const state = getCurrentLicense();
		expect(state.payload?.edition).toBe('pro');
	});
});
