import { MeteorError } from '@rocket.chat/core-services';

import { validateUserRoles } from './validateUserRoles';
import { callbacks } from '../../../../lib/callbacks';
import { i18n } from '../../../../server/lib/i18n';

import { isActiveUsersLimitReached } from '../../../../server/lib/nicesoft-license';

callbacks.add(
	'beforeSaveUser',
	async ({ user, oldUser }) => validateUserRoles(user, oldUser),
	callbacks.priority.HIGH,
	'validateUserRoles',
);

callbacks.add(
	'beforeActivateUser',
	async () => {
		if (await isActiveUsersLimitReached()) {
			throw new MeteorError('error-license-user-limit-reached', i18n.t('error-license-user-limit-reached'));
		}
		return undefined;
	},
	callbacks.priority.HIGH,
	'validateUserStatus',
);
