import { Action, createAction } from '@bigcommerce/data-store';
import { createScriptLoader, createStylesheetLoader } from '@bigcommerce/script-loader';
import { merge } from 'lodash';
import { Observable, of } from 'rxjs';

import { getBillingAddress } from '../../../billing/billing-addresses.mock';
import { createCheckoutStore, CheckoutStore } from '../../../checkout';
import { getCheckoutStoreState } from '../../../checkout/checkouts.mock';
import { InvalidArgumentError, NotInitializedError, NotInitializedErrorType } from '../../../common/error/errors';
import { getCustomer } from '../../../customer/customers.mock';
import { OrderActionCreator, OrderRequestBody } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { getOrderRequestBody } from '../../../order/internal-orders.mock';
import PaymentMethod from '../../payment-method';
import PaymentMethodActionCreator from '../../payment-method-action-creator';
import { PaymentMethodActionType } from '../../payment-method-actions';
import { PaymentInitializeOptions } from '../../payment-request-options';
import { getDigitalRiverJs, getInitializeOptions } from '../digitalriver/digitalriver.mock';

import { OnCancelOrErrorResponse } from './digitalriver';
import DigitalRiverPaymentStrategy from './digitalriver-payment-strategy';
import DigitalRiverScriptLoader from './digitalriver-script-loader';

describe('DigitalRiverPaymentStrategy', () => {
    let paymentMethodActionCreator: PaymentMethodActionCreator;
    let payload: OrderRequestBody;
    let store: CheckoutStore;
    let loadPaymentMethodAction: Observable<Action>;
    let strategy: DigitalRiverPaymentStrategy;
    let digitalRiverScriptLoader: DigitalRiverScriptLoader;
    let paymentMethodMock: PaymentMethod;
    let orderActionCreator: OrderActionCreator;

    beforeEach(() => {
        const scriptLoader = createScriptLoader();
        const stylesheetLoader = createStylesheetLoader();

        digitalRiverScriptLoader = new DigitalRiverScriptLoader(scriptLoader, stylesheetLoader);
        store = createCheckoutStore(getCheckoutStoreState());
        jest.spyOn(store, 'dispatch');
        loadPaymentMethodAction = of(createAction(PaymentMethodActionType.LoadPaymentMethodSucceeded, paymentMethodMock, { methodId: paymentMethodMock.id }));
        paymentMethodActionCreator = {} as PaymentMethodActionCreator;
        paymentMethodActionCreator.loadPaymentMethod = jest.fn(() => loadPaymentMethodAction);

        strategy = new DigitalRiverPaymentStrategy(
            store,
            digitalRiverScriptLoader,
            paymentMethodActionCreator,
            orderActionCreator
        );
    });

    describe('#initialize()', () => {
        let options: PaymentInitializeOptions;
        let onErrorCallback: (error: OnCancelOrErrorResponse) => {};

        const digitalRiverLoadResponse = getDigitalRiverJs();
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

        it('throws an error when load response is empty or not provided', async () => {
            jest.spyOn(digitalRiverScriptLoader, 'load').mockReturnValue(Promise.resolve(undefined));
            const promise = strategy.initialize(options);
            try {
                strategy.initialize(options);
            } catch (error) {
                expect(true).toBeTruthy();
            }

            return expect(promise).rejects.toThrow(NotInitializedError);
        });

        it('loads DigitalRiver script', async () => {
            await expect(strategy.initialize(options)).resolves.toBe(store.getState());
            expect(digitalRiverScriptLoader.load).toHaveBeenCalled();
        });

        it('throws an error when DigitalRiver options is not provided', () => {

            options.digitalriver = undefined;

            const promise = strategy.initialize(options);
            const error = new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);

            return expect(promise).rejects.toThrow(error);
        });

        it('throws an error when customer is not provided', () => {

            jest.spyOn(store.getState().customer, 'getCustomer').mockReturnValue(undefined);

            const promise = strategy.initialize(options);
            const error = new NotInitializedError(NotInitializedErrorType.CustomerNotInitialized);

            return expect(promise).rejects.toThrow(error);
        });

        it('calls onError callback from DigitalRiver', async () => {
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockImplementation(({onError}) => {
                onErrorCallback = onError;

                return digitalRiverComponent;
            });
            await strategy.initialize(options);
            onErrorCallback({
                errors: [{
                    code: 'code',
                    message: 'message',
                }],
            });
            expect(options.digitalriver?.onError).toBeCalled();
            expect(digitalRiverLoadResponse.createDropin).toBeCalled();
        });

        it('throws an error when data on onSuccess event is not provided', async () => {
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockImplementation(({ onSuccess }) => {
                try {
                    onSuccess(undefined);
                } catch (error) {
                    expect(true).toBeTruthy();
                }

                return digitalRiverComponent;
            });
            await strategy.initialize(options);
            expect(true).toBeTruthy();
        });

        it('calls onSuccess callback from DigitalRiver', async () => {
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockImplementation(({ onSuccess }) => {
                onSuccess({
                    source: {
                        id: '1',
                        reusable: false,
                    },
                    readyForStorage: true,
                });

                return digitalRiverComponent;
            });
            await strategy.initialize(options);
            expect(true).toBeTruthy();
        });
    });

    describe('#execute()', () => {

        beforeEach(() => {
            payload = merge({}, getOrderRequestBody(), {
                payment: {
                    useStoreCredit: false,
                    payment: {
                        methodId: 'digitalriver',
                        paymentData: {instrumentId: '123', shouldSetAsDefaultInstrument: true},
                    },
                },
            });
        });

        it('returns the state', async () => {
            expect(await strategy.execute(payload)).toEqual(store.getState());
        });

        it('throws an error when payment is not provided', async () => {

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
