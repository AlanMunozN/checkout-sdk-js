import { createScriptLoader, createStylesheetLoader } from '@bigcommerce/script-loader';
import { merge } from 'lodash';

import { getBillingAddress } from '../../../billing/billing-addresses.mock';
import { createCheckoutStore, CheckoutStore } from '../../../checkout';
import { getCheckoutStoreState } from '../../../checkout/checkouts.mock';
import { InvalidArgumentError, NotInitializedError, NotInitializedErrorType } from '../../../common/error/errors';
import { getCustomer } from '../../../customer/customers.mock';
import { OrderRequestBody } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { getOrderRequestBody } from '../../../order/internal-orders.mock';
import { PaymentInitializeOptions } from '../../payment-request-options';
import { getDR, getInitializeOptions } from '../digitalriver/digitalriver.mock';

import DigitalRiverPaymentStrategy from './digitalriver-payment-strategy';
import DigitalRiverScriptLoader from './digitalriver-script-loader';

describe('DigitalRiverPaymentStrategy', () => {
    let payload: OrderRequestBody;
    let store: CheckoutStore;
    let strategy: DigitalRiverPaymentStrategy;
    let digitalRiverScriptLoader: DigitalRiverScriptLoader;

    beforeEach(() => {
        const scriptLoader = createScriptLoader();
        const stylesheetLoader = createStylesheetLoader();

        digitalRiverScriptLoader = new DigitalRiverScriptLoader(scriptLoader, stylesheetLoader);
        store = createCheckoutStore(getCheckoutStoreState());
        jest.spyOn(store, 'dispatch');

        strategy = new DigitalRiverPaymentStrategy(
            store,
            digitalRiverScriptLoader
        );
    });

    describe('#initialize()', () => {
        let options: PaymentInitializeOptions;
        const digitalRiverLoadResponse = getDR();
        const digitalRiverComponent = digitalRiverLoadResponse.createDropin(expect.any(Object));
        const customer = getCustomer();

        beforeEach(() => {
            options = getInitializeOptions();
            jest.spyOn(store.getState().billingAddress, 'getBillingAddressOrThrow').mockReturnValue(getBillingAddress());
            customer.addresses[0].phone = '';

            jest.spyOn(store.getState().customer, 'getCustomer').mockReturnValue(customer);
            jest.spyOn(digitalRiverScriptLoader, 'load').mockReturnValue(Promise.resolve(digitalRiverLoadResponse));
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockReturnValue(digitalRiverComponent);
        });

        it('returns the state', async () => {
            await expect(strategy.initialize(options)).resolves.toBe(store.getState());
        });

        it('loads digitalRiver script', async () => {
            await expect(strategy.initialize(options)).resolves.toBe(store.getState());
            expect(digitalRiverScriptLoader.load).toHaveBeenCalled();
        });

        it('initialization digital river options are not provided', () => {

            options.digitalriver = undefined;

            const promise = strategy.initialize(options);
            const error = new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);

            return expect(promise).rejects.toThrow(error);
        });

        it('customer are not provided', () => {

            jest.spyOn(store.getState().customer, 'getCustomer').mockReturnValue(undefined);

            const promise = strategy.initialize(options);
            const error = new NotInitializedError(NotInitializedErrorType.CustomerNotInitialized);

            return expect(promise).rejects.toThrow(error);
        });
    });

    describe('#execute()', () => {

        beforeEach(() => {
        payload = merge({}, getOrderRequestBody(), {
            payment: {
                useStoreCredit: false,
                payment: { methodId: 'digitalriver', paymentData: { instrumentId: '123', shouldSetAsDefaultInstrument: true } },
            },
        });
        });

        it('returns the state', async () => {
            expect(await strategy.execute(payload)).toEqual(store.getState());
        });

        it('returns payload error', async () => {

            payload.payment = undefined;

            await expect(() => strategy.execute(payload, undefined)).toThrow(InvalidArgumentError);
        });
    });

    describe('#finalize()', () => {
        it('throws an error to inform that order finalization is not required', async () => {
            const promise = strategy.finalize();

            return expect(promise).rejects.toBeInstanceOf(OrderFinalizationNotRequiredError);
        });
    });

    describe('#deinitialize()', () => {
        it('returns the state', async () => {
            expect(await strategy.deinitialize()).toEqual(store.getState());
        });
    });
});
