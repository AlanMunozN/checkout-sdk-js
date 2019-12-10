import { CheckoutStore, InternalCheckoutSelectors } from '../../../checkout';
import { OrderActionCreator, OrderRequestBody } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { PaymentArgumentInvalidError } from '../../errors';
import PaymentActionCreator from '../../payment-action-creator';
import { PaymentInitializeOptions, PaymentRequestOptions } from '../../payment-request-options';
import * as paymentStatusTypes from '../../payment-status-types';
import PaymentStrategy from '../payment-strategy';

import { BlueSnapV2PaymentInitializeOptions } from './bluesnapv2-payment-options';
import BlueSnapV2WidgetLoader from './bluesnapv2-widget-loader';

export default class BlueSnapV2PaymentStrategy implements PaymentStrategy {

    private readonly IFRAME_NAME = 'bluesnapv2_hosted_payment_page';
    private _initializeOptions?: BlueSnapV2PaymentInitializeOptions;

    constructor(
        private _store: CheckoutStore,
        private _orderActionCreator: OrderActionCreator,
        private _paymentActionCreator: PaymentActionCreator,
        private _widgetLoader: BlueSnapV2WidgetLoader
    ) {}

    execute(orderRequest: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        const { payment } = orderRequest;

        if (!payment) {
            throw new PaymentArgumentInvalidError(['payment']);
        }

        return this._store.dispatch(this._orderActionCreator.submitOrder(orderRequest, options))
            .then(() =>
                Promise.race([
                    this._widgetLoader.load(this.IFRAME_NAME, this._initializeOptions),
                    this._store.dispatch(
                        this._paymentActionCreator.initializeOffsitePayment(payment.methodId, payment.gatewayId, '', false, this.IFRAME_NAME),
                        {
                            queueId: 'BlueSnapV2PaymentStrategy:initializeOffsitePayment:' + Math.random().toString(36).slice(-7),
                        }
                    ),
                ])
                .then(() => this._store.getState())
            );
    }

    finalize(options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        const state = this._store.getState();
        const order = state.order.getOrder();
        const status = state.payment.getPaymentStatus();

        if (order && (status === paymentStatusTypes.ACKNOWLEDGE || status === paymentStatusTypes.FINALIZE)) {
            return this._store.dispatch(this._orderActionCreator.finalizeOrder(order.orderId, options));
        }

        return Promise.reject(new OrderFinalizationNotRequiredError());
    }

    initialize(options?: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        this._initializeOptions = options && options.bluesnapv2;

        return Promise.resolve(this._store.getState());
    }

    deinitialize(): Promise<InternalCheckoutSelectors> {
        return Promise.resolve(this._store.getState());
    }
}
