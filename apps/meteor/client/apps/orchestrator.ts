import { AppClientManager } from '@rocket.chat/apps-engine/client/AppClientManager';
import type { AppsEngineUIHost } from '@rocket.chat/apps-engine/client/AppsEngineUIHost';
import type { IPermission } from '@rocket.chat/apps-engine/definition/permissions/IPermission';
import type { ISetting } from '@rocket.chat/apps-engine/definition/settings';
import type { Serialized } from '@rocket.chat/core-typings';

import type { IAppExternalURL, ICategory } from './@types/IOrchestrator';
import { RealAppsEngineUIHost } from './RealAppsEngineUIHost';
import { hasAtLeastOnePermission } from '../../app/authorization/client';
import { sdk } from '../../app/utils/client/lib/SDKClient';
import { dispatchToastMessage } from '../lib/toast';
import type { App } from '../views/marketplace/types';

const isErrorObject = (e: unknown): e is { error: string } =>
        typeof e === 'object' && e !== null && 'error' in e && typeof (e as { error: unknown }).error === 'string';

type MarketplaceHealth = { ok: boolean; error?: string };

type MarketplaceAppsResponse = { apps: App[]; health?: MarketplaceHealth };

class AppClientOrchestrator {
	private _appClientUIHost: AppsEngineUIHost;

	private _manager: AppClientManager;

	private _isLoaded: boolean;

	constructor() {
		this._appClientUIHost = new RealAppsEngineUIHost();
		this._manager = new AppClientManager(this._appClientUIHost);
		this._isLoaded = false;
	}

	public async load(): Promise<void> {
		if (!this._isLoaded) {
			this._isLoaded = true;
		}
	}

	public getAppClientManager(): AppClientManager {
		return this._manager;
	}

	public handleError(error: unknown): void {
		if (hasAtLeastOnePermission(['manage-apps'])) {
			dispatchToastMessage({
				type: 'error',
				message: error,
			});
		}
	}

	public async getInstalledApps(): Promise<App[]> {
		const result = await sdk.rest.get<'/apps/installed'>('/apps/installed', { includeClusterStatus: 'true' });

		if ('apps' in result) {
			// TODO: chapter day: multiple results are returned, but we only need one
			return result.apps as App[];
		}
		throw new Error('Invalid response from API');
	}

        public async getAppsFromMarketplace(
                isAdminUser?: boolean,
        ): Promise<{ apps: App[]; error?: unknown; health?: MarketplaceHealth }> {
                let result: MarketplaceAppsResponse | App[] | undefined;
                try {
                        result = await sdk.rest.get('/apps/marketplace', { isAdminUser: isAdminUser ? isAdminUser.toString() : 'false' });
                } catch (e) {
                        if (isErrorObject(e)) {
                                if (e.error === 'Marketplace_Unsupported_Version') {
                                        return { apps: [], error: e.error, health: { ok: false, error: e.error } };
                                }

                                return { apps: [], health: { ok: false, error: e.error } };
                        }
                        if (typeof e === 'string') {
                                if (e === 'Marketplace_Unsupported_Version') {
                                        return { apps: [], error: e, health: { ok: false, error: e } };
                                }

                                return { apps: [], health: { ok: false, error: e } };
                        }

                        return { apps: [], health: { ok: false } };
                }

                const normalizedResponse: MarketplaceAppsResponse = Array.isArray(result)
                        ? { apps: result, health: { ok: true } }
                        : { apps: result?.apps || [], health: result?.health || { ok: false, error: 'Invalid response from API' } };

                if (!Array.isArray(normalizedResponse.apps)) {
                        return { apps: [], error: 'Invalid response from API', health: normalizedResponse.health };
                }

                const apps = normalizedResponse.apps.map((app: App) => {
                        const { latest, appRequestStats, price, pricingPlans, purchaseType, isEnterpriseOnly, modifiedAt, bundledIn, requestedEndUser } = app;
                        return {
                                ...latest,
                                appRequestStats,
                                price,
                                pricingPlans,
                                purchaseType,
                                isEnterpriseOnly,
                                modifiedAt,
                                bundledIn,
                                requestedEndUser,
                        };
                });

                return { apps, error: undefined, health: normalizedResponse.health };
        }

	public async getAppsOnBundle(bundleId: string): Promise<App[]> {
		const { apps } = await sdk.rest.get(`/apps/bundles/${bundleId}/apps`);
		return apps;
	}

	public async getApp(appId: string): Promise<App> {
		const { app } = await sdk.rest.get(`/apps/${appId}` as any);
		return app;
	}

	public async setAppSettings(appId: string, settings: ISetting[]): Promise<void> {
		await sdk.rest.post(`/apps/${appId}/settings`, { settings });
	}

	public async installApp(appId: string, version: string, permissionsGranted?: IPermission[]): Promise<App> {
		const { app } = (await sdk.rest.post<'/apps'>('/apps', {
			appId,
			marketplace: true,
			version,
			permissionsGranted,
		})) as { app: App };
		return app;
	}

	public async updateApp(appId: string, version: string, permissionsGranted?: IPermission[]): Promise<App> {
		const result = await sdk.rest.post<'/apps/:id'>(`/apps/${appId}`, {
			appId,
			marketplace: true,
			version,
			permissionsGranted,
		});

		if ('app' in result) {
			return result.app;
		}
		throw new Error('App not found');
	}

	public async buildExternalUrl(appId: string, purchaseType: 'buy' | 'subscription' = 'buy', details = false): Promise<IAppExternalURL> {
		const result = await sdk.rest.get('/apps/buildExternalUrl', {
			appId,
			purchaseType,
			details: `${details}`,
		});

		if ('url' in result) {
			return result;
		}

		throw new Error('Failed to build external url');
	}

	public async buildExternalAppRequest(appId: string) {
		const result = await sdk.rest.get('/apps/buildExternalAppRequest', {
			appId,
		});

		if ('url' in result) {
			return result;
		}
		throw new Error('Failed to build App Request external url');
	}

	public async buildIncompatibleExternalUrl(appId: string, appVersion: string, action: string): Promise<IAppExternalURL> {
		const result = await sdk.rest.get('/apps/incompatibleModal', {
			appId,
			appVersion,
			action,
		});

		if ('url' in result) {
			return result;
		}

		throw new Error('Failed to build external url');
	}

	public async getCategories(): Promise<Serialized<ICategory[]>> {
		const result = await sdk.rest.get('/apps/categories');

		if (Array.isArray(result)) {
			// TODO: chapter day: multiple results are returned, but we only need one
			return result as Serialized<ICategory>[];
		}
		throw new Error('Failed to get categories');
	}
}

export const AppClientOrchestratorInstance = new AppClientOrchestrator();
