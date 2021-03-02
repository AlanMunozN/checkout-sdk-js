import { ScriptLoader, StylesheetLoader } from '@bigcommerce/script-loader';

import { PaymentMethodClientUnavailableError } from '../../errors';

import { DigitalRiverWindow } from './digitalriver';
import DigitalRiverScriptLoader from './digitalriver-script-loader';
import { getDigitalRiverJs } from './digitalriver.mock';

describe('DigitalRiverScriptLoader', () => {
    let digitalRiverScriptLoader: DigitalRiverScriptLoader;
    let scriptLoader: ScriptLoader;
    let stylesheetLoader: StylesheetLoader;
    let mockWindow: DigitalRiverWindow;

    beforeEach(() => {
        mockWindow = {} as DigitalRiverWindow;
        scriptLoader = {} as ScriptLoader;
        stylesheetLoader = {} as StylesheetLoader;
        digitalRiverScriptLoader = new DigitalRiverScriptLoader(scriptLoader, stylesheetLoader, mockWindow);
    });

    describe('#load()', () => {
        const digitalRiverJs = getDigitalRiverJs();
        const jsUrl = 'https://js.digitalriverws.com/v1/DigitalRiver.js';
        const cssUrl = 'https://js.digitalriverws.com/v1/css/DigitalRiver.css';

        beforeEach(() => {
            scriptLoader.loadScript = jest.fn(() => {
                mockWindow.DigitalRiver = jest.fn(
                    () => digitalRiverJs
                );

                return Promise.resolve();
            });

            stylesheetLoader.loadStylesheet = jest.fn(() => Promise.resolve());
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('loads the JS and CSS', async () => {
            await digitalRiverScriptLoader.load('pk_test1234', 'en-US');

            expect(scriptLoader.loadScript).toHaveBeenCalledWith(jsUrl);
            expect(stylesheetLoader.loadStylesheet).toHaveBeenCalledWith(cssUrl);
        });

        it('throws an error when window is not set', async () => {
            scriptLoader.loadScript = jest.fn(() => {
                mockWindow.DigitalRiver = undefined;

                return Promise.resolve();
            });

            try {
                await digitalRiverScriptLoader.load('pk_test_fail', 'en-US');
            } catch (error) {
                expect(error).toBeInstanceOf(PaymentMethodClientUnavailableError);
            }
        });
    });
});
