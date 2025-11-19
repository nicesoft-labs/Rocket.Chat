import { Users } from '@rocket.chat/models';

import { isActiveUsersLimitReached } from './limits';
import { getLimit, isLicensed } from './helpers';

jest.mock('@rocket.chat/models', () => ({
	Users: {
		getActiveLocalUserCount: jest.fn(),
		getActiveLocalGuestCount: jest.fn(),
	},
}));

jest.mock('./helpers', () => ({
	__esModule: true,
	getLimit: jest.fn(),
	isLicensed: jest.fn(),
}));

describe('nicesoft license limits', () => {
	const getActiveLocalUserCountMock = Users.getActiveLocalUserCount as jest.MockedFunction<typeof Users.getActiveLocalUserCount>;
	const isLicensedMock = isLicensed as jest.MockedFunction<typeof isLicensed>;
	const getLimitMock = getLimit as jest.MockedFunction<typeof getLimit>;

	beforeEach(() => {
		jest.clearAllMocks();
		isLicensedMock.mockReturnValue(true);
		getLimitMock.mockReturnValue(10);
		getActiveLocalUserCountMock.mockResolvedValue(0);
	});

	it('allows new users when there is no license', async () => {
		isLicensedMock.mockReturnValue(false);

		await expect(isActiveUsersLimitReached()).resolves.toBe(false);
		expect(getActiveLocalUserCountMock).not.toHaveBeenCalled();
	});

	it('allows new users when no active user limit is present', async () => {
		getLimitMock.mockReturnValue(null);

		await expect(isActiveUsersLimitReached()).resolves.toBe(false);
		expect(getActiveLocalUserCountMock).not.toHaveBeenCalled();
	});

	it('allows creating users when the current usage is below the limit', async () => {
		getActiveLocalUserCountMock.mockResolvedValue(9);

		await expect(isActiveUsersLimitReached()).resolves.toBe(false);
	});

	it('prevents new users when the active seats limit has been reached', async () => {
		getActiveLocalUserCountMock.mockResolvedValue(10);

		await expect(isActiveUsersLimitReached()).resolves.toBe(true);
	});
});
