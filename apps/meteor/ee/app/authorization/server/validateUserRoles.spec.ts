import { MeteorError } from '@rocket.chat/core-services';

import { validateUserRoles } from './validateUserRoles';
import { isActiveUsersLimitReached, isGuestUsersLimitReached } from '../../../../server/lib/nicesoft-license';

jest.mock('../../../../server/lib/nicesoft-license', () => ({
	__esModule: true,
	isActiveUsersLimitReached: jest.fn(),
	isGuestUsersLimitReached: jest.fn(),
}));

const isActiveUsersLimitReachedMock = isActiveUsersLimitReached as jest.MockedFunction<typeof isActiveUsersLimitReached>;
const isGuestUsersLimitReachedMock = isGuestUsersLimitReached as jest.MockedFunction<typeof isGuestUsersLimitReached>;

beforeEach(() => {
	isActiveUsersLimitReachedMock.mockResolvedValue(false);
	isGuestUsersLimitReachedMock.mockResolvedValue(false); 
});

describe('Operating after activeUsers Limits', () => {
	beforeEach(() => {
		isActiveUsersLimitReachedMock.mockResolvedValue(true);
	});

	describe('Adding a new user', () => {
		it('should  throw error when user is active as undefined', async () => {
			const user = {
				roles: ['user'],
			};

			await expect(validateUserRoles(user)).rejects.toThrow(MeteorError);
		});

		it('should not throw error when user is not active', async () => {
			const user = {
				active: false,
				type: 'user',
			};

			await expect(validateUserRoles(user)).resolves.not.toThrow();
		});

		it('should not throw error when user is an app', async () => {
			const user = {
				active: true,
				type: 'app',
			};

			await expect(validateUserRoles(user)).resolves.not.toThrow();
		});

		it('should not throw error when user is a bot', async () => {
			const user = {
				active: true,
				type: 'bot',
			};

			await expect(validateUserRoles(user)).resolves.not.toThrow();
		});

		it('should not throw error when user is a guest', async () => {
			const user = {
				active: true,
				type: 'user',
				roles: ['guest'],
			};

			await expect(validateUserRoles(user)).resolves.not.toThrow();
		});

		it('should throw error when user is active', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			await expect(validateUserRoles(user)).rejects.toThrow(MeteorError);
		});
	});

	describe('Editing an existing user', () => {
		it('should throw an error when we try to activate a user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			const currentUser = {
				active: false,
				type: 'user',
			};
			await expect(validateUserRoles(user, currentUser)).rejects.toThrow(MeteorError);
		});

		it('should not throw an error when we try to deactivate a user', async () => {
			const user = {
				active: false,
				type: 'user',
			};
			const currentUser = {
				active: true,
				type: 'user',
			};
			await expect(validateUserRoles(user, currentUser)).resolves.not.toThrow();
		});

		it('should not throw an error when we try to edit a guest', async () => {
			const user = {
				active: true,
				type: 'user',
				roles: ['guest'],
			};
			const currentUser = {
				active: true,
				type: 'user',
				roles: ['guest'],
			};
			await expect(validateUserRoles(user, currentUser)).resolves.not.toThrow();
		});

		it('should throw an error when we try to convert a guest to a user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			const currentUser = {
				active: true,
				type: 'user',
				roles: ['guest'],
			};
			await expect(validateUserRoles(user, currentUser)).rejects.toThrow(MeteorError);
		});

		it('should throw an error when we try to convert a bot to a user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			const currentUser = {
				active: true,
				type: 'bot',
			};
			await expect(validateUserRoles(user, currentUser)).rejects.toThrow(MeteorError);
		});

		it('should throw an error when we try to convert an app to a user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			const currentUser = {
				active: true,
				type: 'app',
			};
			await expect(validateUserRoles(user, currentUser)).rejects.toThrow(MeteorError);
		});
	});
});

describe('Operating after guestUsers Limits', () => {
	beforeEach(() => {
		isGuestUsersLimitReachedMock.mockResolvedValue(true);
	});

	it('should throw an error when we try to convert an user to guest', async () => {
		const user = {
			active: true,
			type: 'user',
			roles: ['guest'],
		};
		const currentUser = {
			active: true,
			type: 'user',
		};
		await expect(validateUserRoles(user, currentUser)).rejects.toThrow(MeteorError);
	});

	it('should  throw an error when we try to convert app to guest', async () => {
		const user = {
			active: true,
			type: 'user',
			roles: ['guest'],
		};
		const currentUser = {
			active: true,
			type: 'app',
		};
		await expect(validateUserRoles(user, currentUser)).rejects.toThrow(MeteorError);
	});

	it('should not throw an error when we try to edit a guest', async () => {
		const user = {
			active: true,
			type: 'user',
			roles: ['guest'],
		};
		const currentUser = {
			active: true,
			type: 'user',
			roles: ['guest'],
		};
		await expect(validateUserRoles(user, currentUser)).resolves.not.toThrow();
	});
});

describe('Operating under activeUsers Limits', () => {
	beforeEach(() => {
		isActiveUsersLimitReachedMock.mockResolvedValue(false);
	});

	describe('Adding a new user', () => {
		it('should not throw an error validating a regular user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			await expect(validateUserRoles(user)).resolves.not.toThrow();
		});
	});

	describe('Editing an existing user', () => {
		it('should not throw an error when we try to activate a user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			const currentUser = {
				active: false,
				type: 'user',
			};
			await expect(validateUserRoles(user, currentUser)).resolves.not.toThrow();
		});

		it('should not throw an error when we try to convert a guest to a user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			const currentUser = {
				active: true,
				type: 'user',
				roles: ['guest'],
			};
			await expect(validateUserRoles(user, currentUser)).resolves.not.toThrow();
		});
		it('should not throw an error when we try to convert a bot to a user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			const currentUser = {
				active: true,
				type: 'bot',
			};
			await expect(validateUserRoles(user, currentUser)).resolves.not.toThrow();
		});
		it('should not throw an error when we try to convert an app to a user', async () => {
			const user = {
				active: true,
				type: 'user',
			};
			const currentUser = {
				active: true,
				type: 'app',
			};
			await expect(validateUserRoles(user, currentUser)).resolves.not.toThrow();
		});
	});
});
