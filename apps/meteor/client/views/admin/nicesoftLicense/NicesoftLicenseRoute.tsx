import { useAtLeastOnePermission } from '@rocket.chat/ui-contexts';

import NicesoftLicensePage from './NicesoftLicensePage';
import NotAuthorizedPage from '../../notAuthorized/NotAuthorizedPage';

const requiredPermissions = ['manage-licensed-features'] as const;

const NicesoftLicenseRoute = () => {
        const canAccess = useAtLeastOnePermission(requiredPermissions);

        if (!canAccess) {
                return <NotAuthorizedPage />;
        }

        return <NicesoftLicensePage />;
};

export default NicesoftLicenseRoute;
