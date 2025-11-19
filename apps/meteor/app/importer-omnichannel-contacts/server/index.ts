import { ContactImporter } from './ContactImporter';
import { Importers } from '../../importer/server';
import { hasFeature, onLicenseChanged } from '../../../server/lib/nicesoft-license';

let importerRegistered = false;

const registerImporter = (): void => {
        if (importerRegistered || !hasFeature('contact-id-verification')) {
                return;
        }

        Importers.add({
                key: 'omnichannel_contact',
                name: 'omnichannel_contacts_importer',
                importer: ContactImporter,
        });

        importerRegistered = true;
};

registerImporter();

onLicenseChanged(() => {
        registerImporter();
});
