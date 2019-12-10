import { createClient as createPaymentClient } from '@bigcommerce/bigpay-client';
import { createAction } from '@bigcommerce/data-store';
import { createRequestSender } from '@bigcommerce/request-sender';
import { merge } from 'lodash';
import { of, Observable } from 'rxjs';

import { createCheckoutStore, CheckoutRequestSender, CheckoutStore, CheckoutValidator } from '../../../checkout';
import { getCheckoutStoreState } from '../../../checkout/checkouts.mock';
import { FinalizeOrderAction, OrderActionCreator, OrderActionType, OrderRequestBody, OrderRequestSender, SubmitOrderAction } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { getIncompleteOrder, getOrderRequestBody, getSubmittedOrder } from '../../../order/internal-orders.mock';
import { getOrder } from '../../../order/orders.mock';
import { PaymentMethodCancelledError } from '../../errors';
import PaymentActionCreator from '../../payment-action-creator';
import { InitializeOffsitePaymentAction, PaymentActionType } from '../../payment-actions';
import { PaymentInitializeOptions, PaymentRequestOptions } from '../../payment-request-options';
import PaymentRequestSender from '../../payment-request-sender';
import PaymentRequestTransformer from '../../payment-request-transformer';
import * as paymentStatusTypes from '../../payment-status-types';

import BlueSnapV2PaymentStrategy from './bluesnapv2-payment-strategy';
import BlueSnapV2WidgetLoader from './bluesnapv2-widget-loader';

describe('BlueSnapV2PaymentStrategy', () => {
    let finalizeOrderAction: Observable<FinalizeOrderAction>;
    let initializeOffsitePaymentAction: Observable<InitializeOffsitePaymentAction>;
    let orderActionCreator: OrderActionCreator;
    let paymentActionCreator: PaymentActionCreator;
    let initializeOptions: PaymentInitializeOptions;
    let options: PaymentRequestOptions;
    let payload: OrderRequestBody;
    let store: CheckoutStore;
    let strategy: BlueSnapV2PaymentStrategy;
    let submitOrderAction: Observable<SubmitOrderAction>;
    let widgetLoader: BlueSnapV2WidgetLoader;

    beforeEach(() => {
        store = createCheckoutStore(getCheckoutStoreState());
        orderActionCreator = new OrderActionCreator(
            new OrderRequestSender(createRequestSender()),
            new CheckoutValidator(new CheckoutRequestSender(createRequestSender()))
        );
        paymentActionCreator = new PaymentActionCreator(
            new PaymentRequestSender(createPaymentClient()),
            orderActionCreator,
            new PaymentRequestTransformer()
        );
        widgetLoader = new BlueSnapV2WidgetLoader();
        finalizeOrderAction = of(createAction(OrderActionType.FinalizeOrderRequested));
        initializeOffsitePaymentAction = of(createAction(PaymentActionType.InitializeOffsitePaymentRequested));
        submitOrderAction = of(createAction(OrderActionType.SubmitOrderRequested));

        initializeOptions = {
            methodId: 'foobar',
            bluesnapv2: {
                onLoad: jest.fn(),
            },
        };
        options = { methodId: 'foobar' };
        payload = merge(getOrderRequestBody(), {
            payment: {
                methodId: options.methodId,
                paymentData: null,
            },
        });

        jest.spyOn(store, 'dispatch');

        jest.spyOn(orderActionCreator, 'finalizeOrder')
            .mockReturnValue(finalizeOrderAction);

        jest.spyOn(orderActionCreator, 'submitOrder')
            .mockReturnValue(submitOrderAction);

        jest.spyOn(paymentActionCreator, 'initializeOffsitePayment')
            .mockReturnValue(initializeOffsitePaymentAction);

        strategy = new BlueSnapV2PaymentStrategy(store, orderActionCreator, paymentActionCreator, widgetLoader);
    });

    it('submits order with payment data', async () => {
        await strategy.initialize(initializeOptions);
        await strategy.execute(payload, options);

        expect(orderActionCreator.submitOrder).toHaveBeenCalledWith(payload, options);
        expect(store.dispatch).toHaveBeenCalledWith(submitOrderAction);
    });

    it('initializes offsite payment flow', async () => {
        await strategy.initialize(initializeOptions);
        await strategy.execute(payload, options);

        expect(paymentActionCreator.initializeOffsitePayment)
            .toHaveBeenCalledWith(
                options.methodId,
                options.gatewayId,
                '',
                false,
                'bluesnapv2_hosted_payment_page'
            );
        expect(store.dispatch).toHaveBeenCalledWith(
            initializeOffsitePaymentAction,
            {
                queueId: expect.stringMatching(
                    /^BlueSnapV2PaymentStrategy:initializeOffsitePayment:[a-z0-9]{7}$/
                ),
            }
        );
    });

    it('returns cancel error if the user cancels flow', () => {
        jest.spyOn(widgetLoader, 'load')
            .mockImplementation(() => Promise.reject(new PaymentMethodCancelledError()));

        return expect(strategy.execute(payload)).rejects.toThrow(PaymentMethodCancelledError);
    });

    it('finalizes order if order is created and payment is acknowledged', async () => {
        const state = store.getState();

        jest.spyOn(state.order, 'getOrder')
            .mockReturnValue(getOrder());

        jest.spyOn(state.payment, 'getPaymentStatus')
            .mockReturnValue(paymentStatusTypes.ACKNOWLEDGE);

        await strategy.finalize(options);

        expect(orderActionCreator.finalizeOrder).toHaveBeenCalledWith(getOrder().orderId, options);
        expect(store.dispatch).toHaveBeenCalledWith(finalizeOrderAction);
    });

    it('finalizes order if order is created and payment is finalized', async () => {
        const state = store.getState();

        jest.spyOn(state.order, 'getOrder')
            .mockReturnValue(getOrder());

        jest.spyOn(state.payment, 'getPaymentStatus')
            .mockReturnValue(paymentStatusTypes.FINALIZE);

        await strategy.finalize(options);

        expect(orderActionCreator.finalizeOrder).toHaveBeenCalledWith(getOrder().orderId, options);
        expect(store.dispatch).toHaveBeenCalledWith(finalizeOrderAction);
    });

    it('does not finalize order if order is not created', async () => {
        const state = store.getState();

        jest.spyOn(state.order, 'getOrder')
            .mockReturnValue(getIncompleteOrder());

        await expect(strategy.finalize()).rejects.toThrow(OrderFinalizationNotRequiredError);
        expect(orderActionCreator.finalizeOrder).not.toHaveBeenCalled();
        expect(store.dispatch).not.toHaveBeenCalledWith(finalizeOrderAction);
    });

    it('does not finalize order if order is not finalized or acknowledged', async () => {
        const state = store.getState();

        jest.spyOn(state.order, 'getOrder')
            .mockReturnValue(merge({}, getSubmittedOrder(), {
                payment: {
                    status: paymentStatusTypes.INITIALIZE,
                },
            }));

        await expect(strategy.finalize()).rejects.toThrow(OrderFinalizationNotRequiredError);
        expect(orderActionCreator.finalizeOrder).not.toHaveBeenCalled();
        expect(store.dispatch).not.toHaveBeenCalledWith(finalizeOrderAction);
    });

    it('throws error if unable to finalize due to missing data', () => {
        const state = store.getState();

        jest.spyOn(state.order, 'getOrder')
            .mockReturnValue(null);

        return expect(strategy.finalize()).rejects.toThrow(OrderFinalizationNotRequiredError);
    });

    it('returns checkout state', async () => {
        await strategy.initialize(initializeOptions);

        return expect(strategy.execute(getOrderRequestBody(), options)).resolves.toEqual(store.getState());
    });
});
