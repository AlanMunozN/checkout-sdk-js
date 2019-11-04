import { CheckoutStore, InternalCheckoutSelectors } from '../../../checkout';
import { OrderActionCreator, OrderRequestBody } from '../../../order';
import { OrderFinalizationNotRequiredError } from '../../../order/errors';
import { PaymentArgumentInvalidError } from '../../errors';
import PaymentActionCreator from '../../payment-action-creator';
import { PaymentInitializeOptions, PaymentRequestOptions } from '../../payment-request-options';
import * as paymentStatusTypes from '../../payment-status-types';
import PaymentStrategy from '../payment-strategy';

import BlueSnapV2PaymentPageLoader from './bluesnapv2-payment-page-loader';

export default class BlueSnapV2PaymentStrategy implements PaymentStrategy {

    private readonly TARGET = 'bluesnapv2_hosted_payment_page';

    constructor(
        private _store: CheckoutStore,
        private _orderActionCreator: OrderActionCreator,
        private _paymentActionCreator: PaymentActionCreator,
        private _blueSnapV2PaymentPageLoader: BlueSnapV2PaymentPageLoader
    ) {}

    execute(orderRequest: OrderRequestBody, options?: PaymentRequestOptions): Promise<InternalCheckoutSelectors> {
        const { payment } = orderRequest;

        if (!payment) {
            throw new PaymentArgumentInvalidError(['payment']);
        }

        return this._store.dispatch(
            this._orderActionCreator.submitOrder(orderRequest, options)
        )
        .then(() =>
            Promise.race([
                this._blueSnapV2PaymentPageLoader.loadPaymentPage(this.TARGET),
                this._store.dispatch(
                    this._paymentActionCreator.initializeOffsitePayment(payment.methodId, payment.gatewayId, this.TARGET),
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

    initialize(options: PaymentInitializeOptions): Promise<InternalCheckoutSelectors> {
        this._blueSnapV2PaymentPageLoader.initialize(options && options.bluesnapv2);

        return Promise.resolve(this._store.getState());
    }

    deinitialize(): Promise<InternalCheckoutSelectors> {
        return Promise.resolve(this._store.getState());
    }
}
