import { hasFeature } from '../../../../server/lib/nicesoft-license';

const DISABLE_CUSTOM_SCRIPTS_FEATURE = 'cloud.disableCustomScripts';


export const disableCustomScripts = () => {
	if (process.env.DISABLE_CUSTOM_SCRIPTS !== 'true') {
	return false;
}

return hasFeature(DISABLE_CUSTOM_SCRIPTS_FEATURE);
};
