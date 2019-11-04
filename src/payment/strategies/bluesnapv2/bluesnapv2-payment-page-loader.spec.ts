import { NotInitializedError } from '../../../common/error/errors';

import BlueSnapV2PaymentPageLoader from './bluesnapv2-payment-page-loader';

describe('BlueSnapV2PaymentPageLoader', () => {
    it('creates an instance of the payment page loader', () => {
        const blueSnapV2PaymentPageLoader = new BlueSnapV2PaymentPageLoader();
        expect(blueSnapV2PaymentPageLoader).toBeInstanceOf(BlueSnapV2PaymentPageLoader);
    });

    it('loads payment page', () => {
        const blueSnapV2PaymentPageLoader = new BlueSnapV2PaymentPageLoader();
        const options = {
            addFrame: jest.fn(),
            removeFrame: jest.fn(),
        };

        blueSnapV2PaymentPageLoader.initialize(options);
        blueSnapV2PaymentPageLoader.loadPaymentPage('iframename');

        expect(options.addFrame.mock.calls[0][1]).toBeInstanceOf(HTMLIFrameElement);
        expect(options.addFrame.mock.calls[0][1].name).toBe('iframename');
    });

    it('throws an error if no initialization data was supplied', () => {
        const blueSnapV2PaymentPageLoader = new BlueSnapV2PaymentPageLoader();

        expect(blueSnapV2PaymentPageLoader.loadPaymentPage('iframename')).rejects.toThrow(NotInitializedError);
    });

    it('unloads payment page', () => {
        const blueSnapV2PaymentPageLoader = new BlueSnapV2PaymentPageLoader();
        const options = {
            addFrame: jest.fn(),
            removeFrame: jest.fn(),
        };

        blueSnapV2PaymentPageLoader.initialize(options);
        blueSnapV2PaymentPageLoader.loadPaymentPage('iframename');

        window.HTMLFormElement.prototype.submit = jest.fn();

        window.postMessage({
            action: 'setExternalCheckout',
            form: {
                action: 'https://foobar.com',
                values: {
                    key1: 'value1',
                    key2: 'value2',
                },
            },
        }, '*');

        return new Promise(resolve => {
            window.addEventListener('message', resolve, false);
        }).then(() => {
            expect(options.removeFrame).toBeCalled();
        });
    });
});
