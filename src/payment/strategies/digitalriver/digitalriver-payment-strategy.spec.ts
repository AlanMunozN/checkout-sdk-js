import { createAction, Action } from '@bigcommerce/data-store';
import { createRequestSender } from '@bigcommerce/request-sender';
import { createScriptLoader, createStylesheetLoader } from '@bigcommerce/script-loader';
import { merge } from 'lodash';
import { of, Observable } from 'rxjs';

import { getBillingAddress } from '../../../billing/billing-addresses.mock';
import { createCheckoutStore, CheckoutRequestSender, CheckoutStore, CheckoutValidator } from '../../../checkout';
import { getCheckoutStoreState } from '../../../checkout/checkouts.mock';
import { MissingDataError,
    MissingDataErrorType,
    NotInitializedError,
    NotInitializedErrorType } from '../../../common/error/errors';
import { getCustomer } from '../../../customer/customers.mock';
import { OrderActionCreator,
    OrderActionType,
    OrderRequestBody,
    OrderRequestSender,
    SubmitOrderAction } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { getOrderRequestBody } from '../../../order/internal-orders.mock';
import PaymentMethod from '../../payment-method';
import PaymentMethodActionCreator from '../../payment-method-action-creator';
import { PaymentMethodActionType } from '../../payment-method-actions';
import { PaymentInitializeOptions } from '../../payment-request-options';
import { getClientMock,
    getDigitalRiverJs,
    getInitializeOptions,
    getPaymentMethod } from '../digitalriver/digitalriver.mock';

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
        paymentMethodMock = {...getPaymentMethod(), clientToken: JSON.stringify(getClientMock())};
        digitalRiverScriptLoader = new DigitalRiverScriptLoader(scriptLoader, stylesheetLoader);
        store = createCheckoutStore(getCheckoutStoreState());
        jest.spyOn(store, 'dispatch');
        loadPaymentMethodAction = of(createAction(PaymentMethodActionType.LoadPaymentMethodSucceeded, paymentMethodMock, {methodId: paymentMethodMock.id}));
        paymentMethodActionCreator = {} as PaymentMethodActionCreator;
        paymentMethodActionCreator.loadPaymentMethod = jest.fn(() => loadPaymentMethodAction);

        orderActionCreator = new OrderActionCreator(
            new OrderRequestSender(createRequestSender()),
            new CheckoutValidator(new CheckoutRequestSender(createRequestSender()))
        );

        strategy = new DigitalRiverPaymentStrategy(
            store,
            digitalRiverScriptLoader,
            paymentMethodActionCreator,
            orderActionCreator
        );
    });

    describe('#initialize()', () => {
        const digitalRiverLoadResponse = getDigitalRiverJs();
        const digitalRiverComponent = digitalRiverLoadResponse.createDropin(expect.any(Object));
        const customer = getCustomer();
        let options: PaymentInitializeOptions;
        let onErrorCallback: (error: OnCancelOrErrorResponse) => {};

        beforeEach(() => {
            options = getInitializeOptions();
            jest.spyOn(store.getState().billingAddress, 'getBillingAddressOrThrow').mockReturnValue(getBillingAddress());
            jest.spyOn(store.getState().customer, 'getCustomer').mockReturnValue(customer);
            jest.spyOn(digitalRiverScriptLoader, 'load').mockReturnValue(Promise.resolve(digitalRiverLoadResponse));
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockReturnValue(digitalRiverComponent);
        });

        it('returns the state', async () => {
            await expect(strategy.initialize(options)).resolves.toBe(store.getState());
        });

        it('loads DigitalRiver script', async () => {
            await expect(strategy.initialize(options)).resolves.toBe(store.getState());
            expect(digitalRiverScriptLoader.load).toHaveBeenCalled();
        });

        it('calls onSuccess callback from DigitalRiver', async () => {
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockImplementation(({onSuccess}) => {
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

        it('calls onReady callback from DigitalRiver', async () => {
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockImplementation(({onReady}) => {
                onReady({
                    paymentMethodTypes: ['creditCard', 'paypal'],
                });

                return digitalRiverComponent;
            });
            await strategy.initialize(options);
            expect(true).toBeTruthy();
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

        it('throws an error when load response is empty or not provided', () => {
            const promise = strategy.initialize(options);
            jest.spyOn(digitalRiverScriptLoader, 'load').mockReturnValue(Promise.resolve(undefined));

            return expect(promise).rejects.toThrow(NotInitializedError);
        });

        it('throws an error when DigitalRiver options is not provided', () => {
            const error = new NotInitializedError(NotInitializedErrorType.PaymentNotInitialized);
            options.digitalriver = undefined;
            const promise = strategy.initialize(options);

            return expect(promise).rejects.toThrow(error);
        });

        it('throws an error when DigitalRiver clientToken is not provided', () => {
            const error = new MissingDataError(MissingDataErrorType.MissingPaymentMethod);
            paymentMethodMock = {...getPaymentMethod(), clientToken: ''};
            loadPaymentMethodAction = of(createAction(PaymentMethodActionType.LoadPaymentMethodSucceeded, paymentMethodMock, {methodId: paymentMethodMock.id}));
            const promise = strategy.initialize(options);

            return expect(promise).rejects.toThrow(error);
        });

        it('throws an error when DigitalRiver clientToken is not receiving correct data ', () => {
            const error = new Error('Unexpected token o in JSON at position 0');
            paymentMethodMock = {...getPaymentMethod(), clientToken: 'ok'};
            loadPaymentMethodAction = of(createAction(PaymentMethodActionType.LoadPaymentMethodSucceeded, paymentMethodMock, {methodId: paymentMethodMock.id}));
            const promise = strategy.initialize(options);

            return expect(promise).rejects.toThrow(error);
        });

        it('throws an error when customer is not provided', () => {
            const promise = strategy.initialize(options);
            const error = new NotInitializedError(NotInitializedErrorType.CustomerNotInitialized);
            jest.spyOn(store.getState().customer, 'getCustomer').mockReturnValue(undefined);

            return expect(promise).rejects.toThrow(error);
        });

        it('throws an error when data on onSuccess event is not provided', async () => {
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockImplementation(({onSuccess}) => {
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
    });

    describe('#execute()', () => {
        let submitOrderAction: Observable<SubmitOrderAction>;
        let options: PaymentInitializeOptions;
        const digitalRiverLoadResponse = getDigitalRiverJs();
        const digitalRiverComponent = digitalRiverLoadResponse.createDropin(expect.any(Object));

        beforeEach(() => {
            jest.spyOn(digitalRiverScriptLoader, 'load').mockReturnValue(Promise.resolve(digitalRiverLoadResponse));
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockReturnValue(digitalRiverComponent);
            submitOrderAction = of(createAction(OrderActionType.SubmitOrderRequested));
            jest.spyOn(orderActionCreator, 'submitOrder')
                .mockReturnValue(submitOrderAction);
            options = getInitializeOptions();
            payload = merge({}, getOrderRequestBody(), {
                payment: {
                    useStoreCredit: false,
                    order: {
                        order: 'fake',
                    },
                    payment: {
                        methodId: 'digitalriver',
                        paymentData: {instrumentId: '123', shouldSetAsDefaultInstrument: true},
                    },
                },
            });
        });

        it('returns the state', async () => {
            jest.spyOn(digitalRiverLoadResponse, 'createDropin').mockImplementation(({onSuccess}) => {
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
            expect(await strategy.execute(payload)).toEqual(store.getState());
        });

        it('throws an error when payment is not provided', async () => {
            const error = new Error('Unable to proceed because payload payment argument is not provided.');
            payload.payment = undefined;
            const promise = strategy.execute(payload, undefined);

            return expect(promise).rejects.toThrow(error);
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
