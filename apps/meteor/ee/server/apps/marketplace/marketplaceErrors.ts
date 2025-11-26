export class MarketplaceAppsError extends Error {
	constructor(message: string) {
		super(message);
	}
}

export class MarketplaceConnectionError extends Error {
	constructor(message: string) {
		super(message);
	}
}

export class MarketplaceUnsupportedVersionError extends Error {
constructor() {
super('Marketplace_Unsupported_Version');
}
}

export class MarketplaceUnavailableError extends Error {
constructor(message = 'Marketplace_Unavailable') {
super(message);
}
}
