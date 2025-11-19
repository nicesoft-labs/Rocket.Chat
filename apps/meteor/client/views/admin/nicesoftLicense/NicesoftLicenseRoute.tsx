import { useAtLeastOnePermission } from '@rocket.chat/ui-contexts';

import NicesoftLicensePage from './NicesoftLicensePage';
import NotAuthorizedPage from '../../notAuthorized/NotAuthorizedPage';

const requiredPermissions = ['view-privileged-setting', 'edit-privileged-setting'] as const;

const NicesoftLicenseRoute = () => {
        const canAccess = useAtLeastOnePermission(requiredPermissions);

        if (!canAccess) {
                return <NotAuthorizedPage />;
        }

        return <NicesoftLicensePage />;
};

export default NicesoftLicenseRoute;
