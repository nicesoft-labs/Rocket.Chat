import { expect } from 'chai';
import proxyquire from 'proxyquire';
import sinon from 'sinon';

describe('disableCustomScripts', () => {
let disableCustomScripts: () => boolean;
let disableCustomScriptsVar: any;
let hasFeature: sinon.SinonStub;

beforeEach(() => {
disableCustomScriptsVar = process.env.DISABLE_CUSTOM_SCRIPTS;
hasFeature = sinon.stub();

disableCustomScripts = proxyquire('../../../../../../app/lib/server/functions/disableCustomScripts.ts', {
'../../../../server/lib/nicesoft-license': { hasFeature },
}).disableCustomScripts;
});

		const result = disableCustomScripts();
		expect(result).to.be.false;
	});

	it('should return true when DISABLE_CUSTOM_SCRIPTS is true and license is a trial', () => {
		mockLicense.getLicense.returns({
			information: {
				trial: true,
			},
		});

		process.env.DISABLE_CUSTOM_SCRIPTS = 'true';

        afterEach(() => {
                process.env.DISABLE_CUSTOM_SCRIPTS = disableCustomScriptsVar;
                sinon.restore();
        });

        it('should return false when DISABLE_CUSTOM_SCRIPTS is not true', () => {
                hasFeature.returns(true);
                process.env.DISABLE_CUSTOM_SCRIPTS = 'false';

                const result = disableCustomScripts();
                expect(result).to.be.false;
                expect(hasFeature.called).to.be.false;
        });

        it('should return false when feature is not enabled', () => {
                hasFeature.returns(false);
                process.env.DISABLE_CUSTOM_SCRIPTS = 'true';

                const result = disableCustomScripts();
                expect(result).to.be.false;
                expect(hasFeature.calledOnce).to.be.true;
        });

        it('should return true when env flag and feature are enabled', () => {
                hasFeature.returns(true);
                process.env.DISABLE_CUSTOM_SCRIPTS = 'true';

                const result = disableCustomScripts();
                expect(result).to.be.true;
                expect(hasFeature.calledOnce).to.be.true;
        });
});
